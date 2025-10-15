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
      <header className="admin-panel-card admin-panel-card--hero admin-inbox-hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl min-w-0 space-y-3">
            <span className="admin-inbox-badge">
              Inbox
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[32px]">
                Contact Messages
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--admin-muted-rgb))] sm:text-base">
                Review submissions from the public contact form and take action on
                new requests as they arrive.
              </p>
            </div>
          </div>
          <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2 sm:items-center lg:max-w-sm">
            <div className="admin-inbox-summary sm:justify-start">
              <span className="admin-inbox-summary__icon">
                <Filter className="size-4" strokeWidth={1.75} />
              </span>
              <div className="admin-inbox-summary__meta">
                <span className="admin-inbox-summary__label">
                  Filter
                </span>
                <span className="admin-inbox-summary__value">
                  {filteredLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="admin-button admin-button--surface w-full justify-center gap-2 text-sm uppercase tracking-[0.24em] disabled:cursor-not-allowed disabled:opacity-60 sm:w-full"
            >
              <RefreshCcw className="size-4" strokeWidth={1.75} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <section className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,320px)_320px]">
          <div className="admin-inbox-summary">
            <div className="flex items-center gap-3">
              <span className="admin-inbox-summary__icon">
                <Inbox className="size-4.5" strokeWidth={1.75} />
              </span>
              <div className="admin-inbox-summary__meta">
                <p className="admin-inbox-summary__label sm:tracking-[0.32em]">
                  Messages loaded
                </p>
                <p className="admin-inbox-summary__value">
                  {messages.length}{' '}
                  {messages.length === 1 ? 'message' : 'messages'}
                </p>
              </div>
            </div>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.28em] text-[rgba(var(--admin-muted-rgb),0.68)] md:inline">
              Live
            </span>
          </div>
          <label className="w-full">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(var(--admin-muted-rgb),0.75)] sm:tracking-[0.32em]">
              Filter by status
            </span>
            <div className="admin-inbox-filter mt-2">
              <Filter className="admin-inbox-filter__icon size-4" strokeWidth={1.75} />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as (typeof STATUS_OPTIONS)[number]['value']
                  )
                }
                className="pr-6 text-sm font-medium"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="admin-inbox-filter__chevron size-4" />
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
                  className="admin-inbox-card"
                >
                  <div className="admin-inbox-card__header">
                    <div className="admin-inbox-card__identity">
                      <span className="admin-inbox-card__icon">
                        <Mail className="size-4.5" strokeWidth={1.65} />
                      </span>
                      <div className="admin-inbox-card__details space-y-2">
                        <div className="flex flex-col gap-1">
                          <h2 className="break-words text-lg font-semibold text-[var(--foreground)]">
                            {msg.name || 'Anonymous'}
                          </h2>
                          {msg.email ? (
                            <a
                              href={`mailto:${msg.email}`}
                              className="inline-flex items-center gap-1 break-all text-sm font-medium text-[rgb(var(--admin-accent-rgb))] underline-offset-4 transition hover:text-[rgba(var(--admin-accent-rgb),0.8)]"
                            >
                              {msg.email}
                            </a>
                          ) : (
                            <span className="text-sm text-[rgba(var(--admin-muted-rgb),0.85)]">
                              No email provided
                            </span>
                          )}
                        </div>
                        <dl className="admin-inbox-card__meta">
                          <div>
                            <dt className="sr-only">Topic</dt>
                            <dd className="break-words text-[rgb(var(--admin-text-rgb))]">
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
                  <div className="admin-inbox-card__message">
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
