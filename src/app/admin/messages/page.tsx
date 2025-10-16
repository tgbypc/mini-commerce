'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { toast } from 'react-hot-toast'
import {
  ChevronDown,
  CheckCircle2,
  Loader2,
  Mail,
  MailQuestion,
  RefreshCcw,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type ContactMessage = {
  id: string
  name?: string
  email?: string
  topic?: string
  message?: string
  status?: string
  adminNote?: string
  adminRespondedAt?:
    | { seconds?: number; nanoseconds?: number }
    | { _seconds?: number; _nanoseconds?: number }
    | { toDate?: () => Date }
    | string
    | number
    | Date
    | null
  adminRespondedBy?: string
  adminReadAt?:
    | { seconds?: number; nanoseconds?: number }
    | { _seconds?: number; _nanoseconds?: number }
    | { toDate?: () => Date }
    | string
    | number
    | Date
    | null
  createdAt?:
    | { seconds?: number; nanoseconds?: number }
    | { _seconds?: number; _nanoseconds?: number }
    | { toDate?: () => Date }
    | string
    | number
    | Date
    | null
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'responded', label: 'Responded' },
  { value: 'archived', label: 'Archived' },
] as const

const STATUS_STYLES: Record<string, { label: string; badgeClass: string }> = {
  new: {
    label: 'New',
    badgeClass:
      'inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-blue-700',
  },
  read: {
    label: 'Read',
    badgeClass:
      'inline-flex items-center rounded-full bg-zinc-200 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-700',
  },
  responded: {
    label: 'Responded',
    badgeClass:
      'inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-emerald-700',
  },
  archived: {
    label: 'Archived',
    badgeClass:
      'inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-700',
  },
}

const TOPIC_LABELS: Record<string, string> = {
  general: 'General',
  order: 'Order',
  returns: 'Returns',
  partnership: 'Partnership',
}

function resolveTopicLabel(topic?: string | null) {
  return TOPIC_LABELS[topic ?? ''] ?? topic ?? '—'
}

function formatDate(input: ContactMessage['createdAt']) {
  if (!input) return '—'
  try {
    let date: Date | null = null
    if (input instanceof Date) {
      date = input
    } else if (typeof input === 'string' || typeof input === 'number') {
      const parsed = new Date(input)
      if (!Number.isNaN(parsed.getTime())) {
        date = parsed
      }
    } else if (typeof input === 'object') {
      const maybeToDate = (input as { toDate?: () => Date }).toDate
      if (typeof maybeToDate === 'function') {
        const parsed = maybeToDate()
        date = parsed instanceof Date ? parsed : null
      } else {
        const seconds =
          typeof (input as { seconds?: number }).seconds === 'number'
            ? (input as { seconds: number }).seconds
            : typeof (input as { _seconds?: number })._seconds === 'number'
            ? (input as { _seconds: number })._seconds
            : undefined
        const nanos =
          typeof (input as { nanoseconds?: number }).nanoseconds === 'number'
            ? (input as { nanoseconds: number }).nanoseconds
            : typeof (input as { _nanoseconds?: number })._nanoseconds ===
              'number'
            ? (input as { _nanoseconds: number })._nanoseconds
            : 0
        if (typeof seconds === 'number') {
          date = new Date(seconds * 1000 + Math.floor(nanos / 1e6))
        }
      }
    }
    if (!date || Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
  } catch {
    return '—'
  }
}

export default function AdminMessagesPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]['value']>('')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [updating, setUpdating] = useState(false)
  const [replySubject, setReplySubject] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [replySending, setReplySending] = useState(false)

  const selectedMessage = useMemo(() => {
    if (!selectedId) return null
    return messages.find((msg) => msg.id === selectedId) ?? null
  }, [messages, selectedId])

  const selectedStatusMeta = useMemo(() => {
    if (!selectedMessage) return null
    const statusKey = (selectedMessage.status || '').toLowerCase()
    return (
      STATUS_STYLES[statusKey] ?? {
        label: statusKey ? statusKey : 'Unknown',
        badgeClass:
          'inline-flex items-center rounded-full bg-zinc-200 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-700',
      }
    )
  }, [selectedMessage])

  const selectedTopicLabel = useMemo(
    () => resolveTopicLabel(selectedMessage?.topic),
    [selectedMessage?.topic]
  )

  const selectedRespondedLabel = useMemo(() => {
    if (!selectedMessage?.adminRespondedAt) return null
    return formatDate(selectedMessage.adminRespondedAt)
  }, [selectedMessage?.adminRespondedAt])

  const selectedCreatedLabel = useMemo(() => {
    if (!selectedMessage?.createdAt) return null
    return formatDate(selectedMessage.createdAt)
  }, [selectedMessage?.createdAt])

  const autoMarkedRef = useRef<Set<string>>(new Set())

  const filteredLabel = useMemo(() => {
    const current = STATUS_OPTIONS.find((opt) => opt.value === statusFilter)
    return current?.label ?? STATUS_OPTIONS[0].label
  }, [statusFilter])

  const fetchMessages = useCallback(
    async (filter: ContactMessage['status'] | '') => {
      const query = filter ? `?status=${filter}` : ''
      const token = await user?.getIdToken().catch(() => undefined)
      const res = await fetch(`/api/admin/contact-messages${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          (data && typeof data.error === 'string' && data.error) ||
          'Failed to load messages'
        throw new Error(message)
      }
      const payload = (await res.json()) as { items?: ContactMessage[] }
      return Array.isArray(payload.items) ? payload.items : []
    },
    [user]
  )

  const mutateMessage = useCallback(
    async (
      id: string,
      payload: Partial<Pick<ContactMessage, 'status' | 'adminNote'>>
    ) => {
      const token = await user?.getIdToken().catch(() => undefined)
      const res = await fetch(
        `/api/admin/contact-messages/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          data && typeof data.error === 'string'
            ? data.error
            : 'Failed to update message'
        throw new Error(message)
      }
      const updated = (await res.json()) as ContactMessage
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, ...updated } : msg))
      )
      return updated
    },
    [user]
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const items = await fetchMessages(statusFilter || '')
        if (!alive) return
        setMessages(items)
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [fetchMessages, statusFilter])

  useEffect(() => {
    if (!messages.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !messages.some((msg) => msg.id === selectedId)) {
      setSelectedId(messages[0].id)
    }
  }, [messages, selectedId])

  useEffect(() => {
    setNoteDraft(selectedMessage?.adminNote ?? '')
  }, [selectedMessage?.id, selectedMessage?.adminNote])

  useEffect(() => {
    if (!selectedMessage) {
      setReplySubject('')
      setReplyBody('')
      setReplySending(false)
      return
    }
    const defaultSubject = selectedTopicLabel
      ? `Re: ${selectedTopicLabel}`
      : 'Re: MiniCommerce message'
    setReplySubject(defaultSubject)
    const greeting = selectedMessage.name?.trim()
      ? `Hello ${selectedMessage.name.trim()},\n\n`
      : 'Hello,\n\n'
    setReplyBody(greeting)
    setReplySending(false)
  }, [selectedMessage, selectedTopicLabel])

  useEffect(() => {
    if (!selectedMessage) return
    const statusKey = (selectedMessage.status || '').toLowerCase()
    if (statusKey !== 'new') return
    if (autoMarkedRef.current.has(selectedMessage.id)) return
    autoMarkedRef.current.add(selectedMessage.id)
    mutateMessage(selectedMessage.id, { status: 'read' }).catch((err) => {
      console.error(err)
      autoMarkedRef.current.delete(selectedMessage.id)
    })
  }, [mutateMessage, selectedMessage])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    const toastId = toast.loading('Refreshing messages…')
    try {
      const items = await fetchMessages(statusFilter || '')
      setMessages(items)
      toast.success('Messages updated', { id: toastId })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to refresh messages',
        { id: toastId }
      )
    } finally {
      setRefreshing(false)
    }
  }, [fetchMessages, statusFilter])

  const handleStatusUpdate = useCallback(
    async (nextStatus: string, options: { withNote?: boolean } = {}) => {
      if (!selectedMessage) return
      const targetId = selectedMessage.id
      const normalized = nextStatus.toLowerCase()
      if (!['new', 'read', 'responded', 'archived'].includes(normalized)) {
        toast.error('Unsupported status')
        return
      }
      if (
        normalized === (selectedMessage.status || '').toLowerCase() &&
        !options.withNote
      ) {
        return
      }
      const payload: Partial<Pick<ContactMessage, 'status' | 'adminNote'>> = {
        status: normalized,
      }
      if (options.withNote) {
        payload.adminNote = noteDraft.trim()
      }
      setUpdating(true)
      const toastId = toast.loading('Updating message…')
      try {
        const updated = await mutateMessage(targetId, payload)
        setNoteDraft(updated.adminNote ?? '')
        if (normalized === 'new') {
          autoMarkedRef.current.delete(targetId)
        } else if (normalized === 'read' || normalized === 'responded') {
          autoMarkedRef.current.add(targetId)
        }
        toast.success('Message updated', { id: toastId })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update message',
          { id: toastId }
        )
      } finally {
        setUpdating(false)
      }
    },
    [mutateMessage, noteDraft, selectedMessage]
  )

  const handleSaveNote = useCallback(
    async (markResponded: boolean) => {
      if (!selectedMessage) return
      const targetId = selectedMessage.id
      const trimmed = noteDraft.trim()
      if (!trimmed && !selectedMessage.adminNote && !markResponded) {
        toast.error('Add a note before saving')
        return
      }
      const payload: Partial<Pick<ContactMessage, 'status' | 'adminNote'>> = {
        adminNote: trimmed,
      }
      if (markResponded) {
        payload.status = 'responded'
      }
      setUpdating(true)
      const toastId = toast.loading(
        markResponded ? 'Saving response…' : 'Saving note…'
      )
      try {
        const updated = await mutateMessage(targetId, payload)
        setNoteDraft(updated.adminNote ?? '')
        if (markResponded) {
          autoMarkedRef.current.add(targetId)
        }
        toast.success(markResponded ? 'Marked as responded' : 'Note saved', {
          id: toastId,
        })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to save note',
          { id: toastId }
        )
      } finally {
        setUpdating(false)
      }
    },
    [mutateMessage, noteDraft, selectedMessage]
  )

  const handleSendReply = useCallback(async () => {
    if (!selectedMessage) return
    const subject = replySubject.trim()
    const messageBody = replyBody.trim()
    if (!subject || !messageBody) {
      toast.error('Please provide both subject and message.')
      return
    }
    const token = await user?.getIdToken().catch(() => undefined)
    if (!token) {
      toast.error('Session expired. Please sign in again.')
      return
    }
    setReplySending(true)
    const toastId = toast.loading('Sending email…')
    try {
      const res = await fetch(
        `/api/admin/contact-messages/${selectedMessage.id}/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subject,
            message: messageBody,
            note: noteDraft.trim(),
          }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          data && typeof data.error === 'string'
            ? data.error
            : 'Failed to send email'
        throw new Error(msg)
      }
      const updated = (await res.json()) as ContactMessage
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === updated.id ? { ...msg, ...updated } : msg
        )
      )
      autoMarkedRef.current.add(updated.id)
      toast.success('Email sent', { id: toastId })
      setNoteDraft(updated.adminNote ?? '')
      setReplySending(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email', {
        id: toastId,
      })
      setReplySending(false)
    }
  }, [selectedMessage, replyBody, replySubject, noteDraft, user])

  const messageCounts = useMemo(() => {
    const tally = { new: 0, read: 0, responded: 0, archived: 0 }
    for (const msg of messages) {
      const key = (msg.status || '').toLowerCase()
      if (key in tally) {
        tally[key as keyof typeof tally] += 1
      }
    }
    return tally
  }, [messages])

  const totalMessages = messages.length

  const heroMetrics = useMemo(
    () => [
      { label: 'New', value: messageCounts.new },
      { label: 'Responded', value: messageCounts.responded },
      { label: 'Archived', value: messageCounts.archived },
    ],
    [messageCounts.archived, messageCounts.new, messageCounts.responded]
  )

  const heroSurfaceClass =
    'rounded-4xl border border-zinc-200 bg-white/95 shadow-[0_32px_56px_-30px_rgba(15,23,42,0.28)] dark:border-zinc-700 dark:bg-[#111827]'
  const surfaceCardClass =
    'w-full rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_26px_52px_-32px_rgba(15,23,42,0.22)] transition-transform duration-200 backdrop-blur dark:border-zinc-700 dark:bg-[#0f172a]/80'
  const primaryButtonClass =
    'btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60'
  const outlineButtonClass =
    'btn-outline gap-2 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div className="relative overflow-hidden bg-[#f6f7fb] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <span
        className="pointer-events-none absolute -left-[18%] top-16 size-[320px] rounded-full bg-[rgba(124,58,237,0.14)] blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-10 right-[-22%] size-[360px] rounded-full bg-[rgba(59,130,246,0.12)] blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section
          className={`relative overflow-hidden ${heroSurfaceClass} px-6 py-12 sm:px-10`}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-[-22%] hidden w-[52%] rounded-full bg-gradient-to-br from-[#dbe7ff] via-transparent to-transparent blur-3xl sm:block"
            aria-hidden
          />
          <div className="relative z-[1] grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f6f7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Inbox studio
              </span>
              <h1 className="text-3xl font-semibold text-[#0d141c] md:text-4xl dark:text-white">
                Keep the conversation flowing
              </h1>
              <p className="max-w-2xl text-sm text-zinc-600 md:text-base dark:text-zinc-300">
                Review every contact submission, capture internal notes and
                reach back to customers with confidence. Everything is ready for
                both light and dark themes.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={primaryButtonClass}
                >
                  {refreshing ? 'Refreshing…' : 'Refresh inbox'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('new')}
                  className={outlineButtonClass}
                >
                  View new messages
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-3xl border border-zinc-200 bg-white/95 px-4 py-5 text-center shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)]"
                >
                  <div className="text-2xl font-semibold text-[#0d141c] dark:text-white">
                    {metric.value}
                  </div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className={`${surfaceCardClass} flex flex-col gap-3 px-6 py-6`}>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
              Messages loaded
            </span>
            <div className="text-3xl font-semibold text-[#0d141c] dark:text-white">
              {totalMessages.toString().padStart(2, '0')}
            </div>
            <div className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2 lg:grid-cols-1 dark:text-zinc-300">
              <span className="inline-flex justify-between">
                <span>New</span>
                <span>{messageCounts.new}</span>
              </span>
              <span className="inline-flex justify-between">
                <span>Responded</span>
                <span>{messageCounts.responded}</span>
              </span>
              <span className="inline-flex justify-between">
                <span>Read</span>
                <span>{messageCounts.read}</span>
              </span>
              <span className="inline-flex justify-between">
                <span>Archived</span>
                <span>{messageCounts.archived}</span>
              </span>
            </div>
          </div>
          <div className={`${surfaceCardClass} px-6 py-6`}>
            <label className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                Filter by status
              </span>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as (typeof STATUS_OPTIONS)[number]['value']
                    )
                  }
                  className="w-full appearance-none rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0d141c] shadow-sm transition focus:border-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-100"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
              </div>
            </label>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Showing messages with the “{filteredLabel.toLowerCase()}” filter
              applied.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-5 py-2 text-sm font-semibold text-[#0d141c] transition hover:-translate-y-0.5 hover:border-[#4338ca]/40 hover:bg-[#4338ca]/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100"
            >
              <RefreshCcw className="size-4" strokeWidth={1.75} />
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center rounded-4xl border border-zinc-200 bg-white/95 p-12 text-zinc-600 shadow-[0_26px_52px_-32px_rgba(15,23,42,0.28)] dark:border-zinc-700 dark:bg-[#111827] dark:text-zinc-300">
            <Loader2 className="mr-3 size-5 animate-spin" strokeWidth={1.75} />
            Loading messages…
          </div>
        ) : error ? (
          <div className="rounded-4xl border border-rose-200 bg-rose-50 p-8 text-rose-600 shadow-[0_26px_52px_-32px_rgba(244,63,94,0.25)]">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-4xl border border-zinc-200 bg-white/95 p-16 text-center text-zinc-600 shadow-[0_26px_52px_-32px_rgba(15,23,42,0.28)] dark:border-zinc-700 dark:bg-[#111827] dark:text-zinc-300">
            <MailQuestion
              className="size-12 text-zinc-400"
              strokeWidth={1.75}
            />
            <div>
              <h3 className="text-lg font-semibold text-[#0d141c] dark:text-white">
                No messages yet
              </h3>
              <p className="mt-1 text-sm">
                Messages submitted via the contact form will appear here
                instantly.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <div className="space-y-4 min-w-0">
              {messages.map((msg) => {
                const statusKey = (msg.status || '').toLowerCase()
                const statusMeta = STATUS_STYLES[statusKey] ?? {
                  label: statusKey || 'Unknown',
                  badgeClass:
                    'inline-flex items-center rounded-full bg-zinc-200 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-700',
                }
                const topicLabel = resolveTopicLabel(msg.topic)
                const previewSource = (msg.message ?? '').trim()
                const preview =
                  previewSource.length > 200
                    ? `${previewSource.slice(0, 200)}…`
                    : previewSource || '—'
                const respondedAt = msg.adminRespondedAt
                  ? formatDate(msg.adminRespondedAt)
                  : null
                const receivedAt = formatDate(msg.createdAt)
                const isActive = msg.id === selectedId
                return (
                  <article
                    key={msg.id}
                    className={clsx(
                      `${surfaceCardClass} relative flex flex-col gap-4 px-5 py-5`,
                      isActive
                        ? 'ring-2 ring-[#4338ca]/45'
                        : 'hover:-translate-y-1'
                    )}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <h2 className="break-words text-lg font-semibold text-[#0d141c] dark:text-zinc-100">
                            {msg.name || 'Anonymous'}
                          </h2>
                          {msg.email ? (
                            <a
                              href={`mailto:${msg.email}`}
                              className="inline-flex items-center gap-2 break-all text-sm font-medium text-[#4338ca] underline-offset-4 transition hover:text-[#312e81]"
                            >
                              {msg.email}
                            </a>
                          ) : (
                            <span className="text-sm text-zinc-500">
                              No email provided
                            </span>
                          )}
                        </div>
                        <span className={statusMeta.badgeClass}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>Topic: {topicLabel}</span>
                        <span>Received {receivedAt}</span>
                      </div>
                      <p className="line-clamp-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {preview}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                      {respondedAt ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500">
                          <CheckCircle2
                            className="size-3.5"
                            strokeWidth={1.8}
                          />
                          Responded {respondedAt}
                        </span>
                      ) : (
                        <span>{receivedAt}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(msg.id)}
                        className={clsx(
                          'inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition',
                          isActive
                            ? 'bg-[#4338ca] text-white'
                            : 'text-[#0d141c] hover:border-[#4338ca]/35 hover:bg-[#4338ca]/10 dark:text-zinc-100'
                        )}
                      >
                        {isActive ? 'Viewing' : 'Open message'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className={`${surfaceCardClass} rounded-4xl p-6 min-w-0`}>
              {selectedMessage ? (
                <div className="flex h-full flex-col gap-6">
                  <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
                          From
                        </p>
                        <h2 className="text-2xl font-semibold text-[#0d141c] dark:text-zinc-100">
                          {selectedMessage.name || 'Anonymous'}
                        </h2>
                        {selectedMessage.email ? (
                          <a
                            href={`mailto:${selectedMessage.email}`}
                            className="inline-flex items-center gap-2 break-all text-sm font-semibold text-[#4338ca] underline-offset-4 transition hover:text-[#312e81]"
                          >
                            {selectedMessage.email}
                          </a>
                        ) : (
                          <span className="text-sm text-zinc-500">
                            No email provided
                          </span>
                        )}
                      </div>
                      {selectedStatusMeta ? (
                        <span className={selectedStatusMeta.badgeClass}>
                          {selectedStatusMeta.label}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>Topic: {selectedTopicLabel}</span>
                      {selectedCreatedLabel ? (
                        <span>Received {selectedCreatedLabel}</span>
                      ) : null}
                      {selectedRespondedLabel ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500">
                          <CheckCircle2
                            className="size-3.5"
                            strokeWidth={1.8}
                          />
                          Responded {selectedRespondedLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleStatusUpdate('responded', { withNote: true })
                        }
                        disabled={updating}
                        className={primaryButtonClass}
                      >
                        <CheckCircle2 className="size-4" strokeWidth={1.8} />
                        Mark responded
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate('read')}
                        disabled={updating}
                        className={outlineButtonClass}
                      >
                        Mark read
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate('new')}
                        disabled={updating}
                        className={outlineButtonClass}
                      >
                        Mark new
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate('archived')}
                        disabled={updating}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-400/45 px-4 py-2 text-sm font-semibold text-amber-500 transition hover:-translate-y-0.5 hover:border-amber-400/65 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500/40 dark:text-amber-300 dark:hover:border-amber-400/65 dark:hover:bg-amber-500/20"
                      >
                        Archive
                      </button>
                    </div>
                  </header>
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
                      Message
                    </h3>
                    <div className="rounded-2xl border border-zinc-200 bg-white/95 p-4 text-sm leading-relaxed text-[#0d141c] shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] dark:border-zinc-700 dark:bg-[#101828] dark:text-zinc-100">
                      {selectedMessage.message || '—'}
                    </div>
                  </section>
                  <section className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                        Email reply
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Prepare your response and send it directly from the
                        admin panel.
                      </p>
                    </div>
                    <input
                      type="text"
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      className="w-full rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-[#0d141c] shadow-sm transition focus:border-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-[#101828] dark:text-zinc-100"
                      placeholder="Email subject"
                      disabled={replySending}
                    />
                    <textarea
                      value={replyBody}
                      onChange={(e) =>
                        setReplyBody(e.target.value.slice(0, 2000))
                      }
                      rows={6}
                      className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] outline-none transition placeholder:text-neutral-500 focus:border-[#4338ca] focus:ring-2 focus:ring-[#4338ca]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700"
                      style={{ backgroundColor: '#ffffff', color: '#000000' }}
                      placeholder="Message to the customer"
                      disabled={replySending}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                      <span>{replyBody.length}/2000 characters</span>
                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={replySending}
                        className={primaryButtonClass}
                      >
                        {replySending ? (
                          <>
                            <Loader2
                              className="size-4 animate-spin"
                              strokeWidth={1.75}
                            />
                            Sending…
                          </>
                        ) : (
                          'Send email'
                        )}
                      </button>
                    </div>
                  </section>
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3 text-black">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                        Admin response note
                      </h3>
                      <span className="text-xs text-zinc-500 dark:text-[#0d141c]">
                        Private — customers never see this note
                      </span>
                    </div>
                    <textarea
                      value={noteDraft}
                      onChange={(e) =>
                        setNoteDraft(e.target.value.slice(0, 1000))
                      }
                      maxLength={1000}
                      rows={5}
                      disabled={updating}
                      className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] outline-none transition placeholder:text-neutral-500 focus:border-[#4338ca] focus:ring-2 focus:ring-[#4338ca]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700"
                      style={{ backgroundColor: '#ffffff', color: '#000000' }}
                      placeholder="Add an internal note"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                      <span>{noteDraft.length}/1000 characters</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveNote(false)}
                          disabled={updating}
                          className={`${outlineButtonClass} px-4 py-2`}
                        >
                          Save note
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveNote(true)}
                          disabled={updating}
                          className={primaryButtonClass}
                        >
                          Save & respond
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500">
                  <Mail className="size-12 text-zinc-400" strokeWidth={1.75} />
                  Select a message to review its details.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
