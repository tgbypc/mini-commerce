'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  ChevronDown,
  Filter,
  Inbox,
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
  { value: 'archived', label: 'Archived' },
] as const

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'admin-chip admin-chip--info' },
  read: { label: 'Read', className: 'admin-chip admin-chip--neutral' },
  archived: { label: 'Archived', className: 'admin-chip admin-chip--warning' },
}

const TOPIC_LABELS: Record<string, string> = {
  general: 'General',
  order: 'Order',
  returns: 'Returns',
  partnership: 'Partnership',
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
        setError(
          err instanceof Error ? err.message : 'Failed to load messages'
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [fetchMessages, statusFilter])

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

  return (
    <div className="space-y-6">
      <header className="admin-hero-card admin-card border admin-border overflow-hidden bg-gradient-to-br from-[rgba(17,24,39,0.82)] via-[rgba(30,41,59,0.86)] to-[rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl min-w-0 space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(148,163,184,0.25)] bg-[rgba(30,41,59,0.75)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(var(--admin-muted-rgb),0.85)] sm:tracking-[0.34em]">
              Inbox
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[32px]">
                Contact Messages
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[rgba(203,213,225,0.85)] sm:text-base">
                Review submissions from the public contact form and take action on
                new requests as they arrive.
              </p>
            </div>
          </div>
          <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2 sm:items-center lg:max-w-sm">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-400/30 bg-[rgba(37,99,235,0.14)] px-4 py-3 text-xs text-[var(--foreground)] shadow-[0_16px_32px_-24px_rgba(37,99,235,0.55)] sm:justify-start">
              <Filter className="size-4 text-blue-200" strokeWidth={1.75} />
              <div className="flex min-w-0 flex-col">
                <span className="text-xs uppercase tracking-[0.28em] text-[rgba(191,219,254,0.7)]">
                  Filter
                </span>
                <span className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
                  {filteredLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/35 bg-blue-500/20 px-4 py-3 text-sm font-medium text-blue-100 transition hover:-translate-y-0.5 hover:border-blue-400/45 hover:bg-blue-500/28 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className="size-4" strokeWidth={1.75} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <section className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,320px)_320px]">
          <div className="flex items-center justify-between gap-3 rounded-2xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-4 py-3 text-sm text-[rgb(var(--admin-muted-rgb))]">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl border admin-border bg-blue-500/10 text-blue-300">
                <Inbox className="size-4.5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(var(--admin-muted-rgb),0.7)] sm:tracking-[0.32em]">
                  Messages loaded
                </p>
                <p className="text-base font-semibold text-[var(--foreground)]">
                  {messages.length}{' '}
                  {messages.length === 1 ? 'message' : 'messages'}
                </p>
              </div>
            </div>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.28em] text-[rgba(var(--admin-muted-rgb),0.65)] md:inline">
              Live
            </span>
          </div>
          <label className="w-full">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(var(--admin-muted-rgb),0.75)] sm:tracking-[0.32em]">
              Filter by status
            </span>
            <div className="relative mt-2 flex items-center gap-2 rounded-2xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-within:border-blue-400/45 focus-within:shadow-[0_18px_36px_-24px_rgba(59,130,246,0.5)]">
              <Filter className="size-4 text-blue-300" strokeWidth={1.75} />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as (typeof STATUS_OPTIONS)[number]['value']
                  )
                }
                className="w-full appearance-none bg-transparent pr-6 text-sm font-medium text-[var(--foreground)] focus:outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 size-4 text-[rgba(var(--admin-muted-rgb),0.75)]" />
            </div>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.9)] p-10 text-[rgb(var(--admin-muted-rgb))]">
            <Loader2 className="mr-3 size-5 animate-spin" strokeWidth={1.75} />
            Loading messages…
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-600">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.9)] p-12 text-center text-[rgb(var(--admin-muted-rgb))]">
            <MailQuestion className="size-10" strokeWidth={1.75} />
            <div className="text-lg font-semibold text-[var(--foreground)]">
              No messages yet
            </div>
            <p className="text-sm">
              Messages submitted via the contact form will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            {messages.map((msg) => {
              const statusKey = (msg.status || '').toLowerCase()
              const statusMeta = STATUS_STYLES[statusKey] ?? {
                label: statusKey ? statusKey : 'Unknown',
                className: 'admin-chip admin-chip--neutral',
              }
              const topicLabel =
                TOPIC_LABELS[msg.topic ?? ''] ?? (msg.topic || '—')
              return (
                <article
                  key={msg.id}
                  className="admin-card border admin-border bg-[rgba(var(--admin-surface-rgb),0.9)] p-5 sm:p-6 transition hover:-translate-y-1 hover:border-blue-400/35 hover:shadow-[0_22px_44px_-28px_rgba(37,99,235,0.5)]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-11 items-center justify-center rounded-2xl border border-blue-400/35 bg-gradient-to-br from-blue-500/25 to-indigo-500/20 text-blue-100 shadow-[0_16px_32px_-26px_rgba(37,99,235,0.6)]">
                        <Mail className="size-4.5" strokeWidth={1.65} />
                      </span>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-col gap-1">
                          <h2 className="break-words text-lg font-semibold text-[var(--foreground)]">
                            {msg.name || 'Anonymous'}
                          </h2>
                          {msg.email ? (
                            <a
                              href={`mailto:${msg.email}`}
                              className="inline-flex items-center gap-1 break-all text-sm font-medium text-blue-200 underline-offset-4 transition hover:text-blue-100"
                            >
                              {msg.email}
                            </a>
                          ) : (
                            <span className="text-sm text-[rgba(var(--admin-muted-rgb),0.85)]">
                              No email provided
                            </span>
                          )}
                        </div>
                        <dl className="grid gap-y-1 text-xs uppercase tracking-[0.18em] text-[rgba(var(--admin-muted-rgb),0.72)] sm:grid-cols-2 sm:gap-x-6 sm:tracking-[0.28em]">
                          <div>
                            <dt className="sr-only">Topic</dt>
                            <dd className="break-words text-[var(--foreground)] tracking-[0.18em] sm:tracking-[0.24em]">
                              {topicLabel}
                            </dd>
                          </div>
                          <div>
                            <dt className="sr-only">Received</dt>
                            <dd className="text-[rgba(var(--admin-muted-rgb),0.85)]">
                              {formatDate(msg.createdAt)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                    <span className={`${statusMeta.className} text-[0.62rem]`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3 rounded-2xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.94)] p-4 text-sm text-[var(--foreground)]">
                    <p className="break-words whitespace-pre-line leading-relaxed">
                      {msg.message || '—'}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
