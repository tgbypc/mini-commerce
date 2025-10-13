'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
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
      <header className="admin-hero-card admin-card border admin-border bg-[rgba(var(--admin-surface-rgb),0.85)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[rgb(var(--admin-muted-rgb))]">
              Inbox
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Contact Messages
            </h1>
            <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
              Review submissions from the public contact form.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative inline-flex items-center rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.9)] px-3 py-2 text-xs text-[rgb(var(--admin-muted-rgb))]">
              <Filter className="mr-2 size-4" strokeWidth={1.75} />
              {filteredLabel}
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-600 transition hover:border-blue-400/40 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className="size-4" strokeWidth={1.75} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.9)] px-3 py-2 text-sm text-[rgb(var(--admin-muted-rgb))]">
            <Inbox className="size-4" strokeWidth={1.75} />
            {messages.length}{' '}
            {messages.length === 1 ? 'message' : 'messages'} loaded
          </div>
          <label className="flex items-center gap-2 text-sm text-[rgb(var(--admin-muted-rgb))]">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number]['value'])
              }
              className="rounded-lg border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.9)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
          <div className="grid gap-4">
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
                  className="admin-card border admin-border bg-[rgba(var(--admin-surface-rgb),0.85)] p-6 transition hover:border-blue-400/35 hover:shadow-[0_18px_36px_-30px_rgba(37,99,235,0.45)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 items-center justify-center rounded-2xl border admin-border bg-blue-500/10 text-blue-600">
                        <Mail className="size-4" strokeWidth={1.75} />
                      </span>
                      <div>
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">
                          {msg.name || 'Anonymous'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--admin-muted-rgb))]">
                          {msg.email ? (
                            <a
                              href={`mailto:${msg.email}`}
                              className="font-medium text-blue-600 transition hover:text-blue-700"
                            >
                              {msg.email}
                            </a>
                          ) : (
                            <span>No email</span>
                          )}
                          <span aria-hidden>•</span>
                          <span>{topicLabel}</span>
                          <span aria-hidden>•</span>
                          <span>{formatDate(msg.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <span className={statusMeta.className}>{statusMeta.label}</span>
                  </div>
                  <div className="mt-4 rounded-2xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.9)] p-4 text-sm text-[var(--foreground)]">
                    <p className="whitespace-pre-line">{msg.message || '—'}</p>
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
