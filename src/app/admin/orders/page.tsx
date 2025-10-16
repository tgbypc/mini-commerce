'use client'

import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  ArrowUpRight,
  ChevronDown,
  Filter,
  Loader2,
  PackageSearch,
  RefreshCcw,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type OrderItem = {
  productId?: string | null
  title?: string | null
  quantity?: number | null
  unitAmount?: number | null
  currency?: string | null
}

type Order = {
  id: string
  userId?: string | null
  email?: string | null
  amountTotal?: number | null
  currency?: string | null
  paymentStatus?: string | null
  status?: 'paid' | 'fulfilled' | 'shipped' | 'delivered' | 'canceled'
  createdAt?:
    | { seconds?: number; nanoseconds?: number }
    | string
    | number
    | null
  updatedAt?: unknown
  trackingNumber?: string | null
  carrier?: string | null
  notes?: string | null
  items?: OrderItem[]
}

const STATUSES: NonNullable<Order['status']>[] = [
  'paid',
  'fulfilled',
  'shipped',
  'delivered',
  'canceled',
]

const STATUS_META: Record<
  NonNullable<Order['status']>,
  { label: string; badgeClass: string }
> = {
  paid: {
    label: 'Paid',
    badgeClass:
      'inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:bg-sky-500/20 dark:text-sky-300',
  },
  fulfilled: {
    label: 'Fulfilled',
    badgeClass:
      'inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300',
  },
  shipped: {
    label: 'Shipped',
    badgeClass:
      'inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
  },
  delivered: {
    label: 'Delivered',
    badgeClass:
      'inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  canceled: {
    label: 'Canceled',
    badgeClass:
      'inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-rose-600 dark:bg-rose-500/20 dark:text-rose-300',
  },
}

const HERO_SURFACE_CLASS =
  'rounded-4xl border border-zinc-200 bg-white/95 shadow-[0_32px_56px_-30px_rgba(15,23,42,0.28)] dark:border-zinc-700 dark:bg-[#111827]'
const SURFACE_CARD_CLASS =
  'w-full rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_26px_52px_-32px_rgba(15,23,42,0.22)] transition-transform duration-200 backdrop-blur dark:border-zinc-700 dark:bg-[#0f172a]/80'
const PRIMARY_BUTTON_CLASS =
  'btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60'
const OUTLINE_BUTTON_CLASS =
  'btn-outline gap-2 disabled:cursor-not-allowed disabled:opacity-60'
const SOFT_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#4338ca] transition hover:-translate-y-0.5 hover:border-[#4338ca]/40 hover:bg-[#4338ca]/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-100 dark:hover:border-[#6366f1]/45 dark:hover:bg-[#4338ca]/20'

function isStatus(value: string): value is NonNullable<Order['status']> {
  return STATUSES.includes(value as NonNullable<Order['status']>)
}

function formatCurrency(amount?: number | null, currency = 'USD') {
  const value = typeof amount === 'number' ? amount : Number(amount) || 0
  const code = currency || 'USD'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code.toUpperCase(),
    }).format(value)
  } catch {
    return `${code.toUpperCase()} ${value.toFixed(2)}`
  }
}

function formatDate(input: Order['createdAt']) {
  if (!input) return '—'
  try {
    let date: Date | null = null

    if (input instanceof Date) {
      date = input
    } else if (typeof input === 'string' || typeof input === 'number') {
      const parsed = new Date(input)
      date = Number.isNaN(parsed.getTime()) ? null : parsed
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
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export default function AdminOrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<Order['status'] | ''>('')
  const [saving, setSaving] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = useCallback(
    async (filter: Order['status'] | '') => {
      const token = await user?.getIdToken().catch(() => undefined)
      const query = filter ? `?status=${filter}` : ''
      const res = await fetch(`/api/admin/orders${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          (data && typeof data.error === 'string' && data.error) ||
          'Failed to load orders'
        throw new Error(message)
      }
      const data = (await res.json()) as { items?: Order[] }
      return Array.isArray(data.items) ? data.items : []
    },
    [user]
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const items = await fetchOrders(statusFilter)
        if (!alive) return
        setOrders(items)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Failed to load orders')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [fetchOrders, statusFilter])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    const toastId = toast.loading('Refreshing orders…')
    try {
      const items = await fetchOrders(statusFilter)
      setOrders(items)
      toast.success('Orders updated', { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to refresh orders', {
        id: toastId,
      })
    } finally {
      setRefreshing(false)
    }
  }, [fetchOrders, statusFilter])

  const updateStatus = useCallback(
    async (id: string, status: Order['status']) => {
      if (!user) return
      setSaving(id)
      const toastId = toast.loading('Updating order…')
      try {
        const token = await user.getIdToken().catch(() => undefined)
        const res = await fetch('/api/admin/orders/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ id, status }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const message =
            (data && typeof data.error === 'string' && data.error) ||
            'Update failed'
          throw new Error(message)
        }
        setOrders((prev) =>
          prev.map((order) =>
            order.id === id
              ? { ...order, status: status ?? order.status }
              : order
          )
        )
        toast.success('Order updated', { id: toastId })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed', {
          id: toastId,
        })
      } finally {
        setSaving(null)
      }
    },
    [user]
  )

  const pendingOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status && !['delivered', 'canceled'].includes(order.status)
      ).length,
    [orders]
  )

  const totalRevenue = useMemo(() => {
    return orders.reduce((acc, order) => {
      const amount =
        typeof order.amountTotal === 'number'
          ? order.amountTotal
          : Number(order.amountTotal) || 0
      return acc + amount
    }, 0)
  }, [orders])

  const statusCounts = useMemo(() => {
    const base: Record<NonNullable<Order['status']>, number> = {
      paid: 0,
      fulfilled: 0,
      shipped: 0,
      delivered: 0,
      canceled: 0,
    }
    for (const order of orders) {
      const status = isStatus(String(order.status))
        ? (order.status as NonNullable<Order['status']>)
        : 'paid'
      base[status] += 1
    }
    return base
  }, [orders])

  const totalOrders = orders.length
  const revenueLabel = formatCurrency(
    totalRevenue,
    orders.find((order) => order.currency)?.currency || 'USD'
  )

  const heroMetrics = useMemo(
    () => [
      { label: 'Orders', value: totalOrders.toString().padStart(2, '0') },
      { label: 'Pending', value: pendingOrders.toString().padStart(2, '0') },
      {
        label: 'Delivered',
        value: statusCounts.delivered.toString().padStart(2, '0'),
      },
      { label: 'Revenue', value: revenueLabel },
    ],
    [pendingOrders, revenueLabel, statusCounts.delivered, totalOrders]
  )

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
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 text-[#0d141c] dark:text-white">
        <section
          className={`relative overflow-hidden ${HERO_SURFACE_CLASS} px-6 py-12 sm:px-10`}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-[-22%] hidden w-[52%] rounded-full bg-gradient-to-br from-[#dbe7ff] via-transparent to-transparent blur-3xl sm:block"
            aria-hidden
          />
          <div className="relative z-[1] grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f6f7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:border-zinc-700 dark:bg-[#101828] dark:text-zinc-400">
                Fulfillment studio
              </span>
              <h1 className="text-3xl font-semibold md:text-4xl">
                Keep the order flow moving
              </h1>
              <p className="max-w-2xl text-sm text-zinc-600 md:text-base dark:text-zinc-300">
                Track payments, update fulfillment stages, and surface delivery
                notes without leaving the dashboard.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  {refreshing ? (
                    <>
                      <Loader2
                        className="size-4 animate-spin"
                        strokeWidth={1.75}
                      />
                      Refreshing…
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="size-4" strokeWidth={1.75} />
                      Refresh orders
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('paid')}
                  className={OUTLINE_BUTTON_CLASS}
                >
                  Show pending orders
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-3xl border border-zinc-200 bg-white/90 px-4 py-5 text-center shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] dark:border-zinc-700 dark:bg-[#0b1220]/90"
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
          <div className={`${SURFACE_CARD_CLASS} flex flex-col gap-5 px-6 py-6`}>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
              Filter by status
            </span>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Showing {totalOrders} orders • {pendingOrders} awaiting action.
            </p>
            <label className="relative">
              <span className="sr-only">Order status filter</span>
              <Filter
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#4338ca]"
                strokeWidth={1.75}
              />
              <select
                value={statusFilter || ''}
                onChange={(event) => {
                  const value = event.target.value
                  setStatusFilter(
                    value === '' ? '' : isStatus(value) ? value : ''
                  )
                }}
                className="w-full appearance-none rounded-full border border-zinc-200 bg-white px-10 py-2.5 text-sm font-semibold text-[#0d141c] shadow-sm transition focus:border-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20 dark:border-zinc-700 dark:bg-[#0f172a]/80 dark:text-zinc-100"
              >
                <option value="">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_META[status].label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
            </label>
            <div className="grid gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={clsx(
                    'flex items-center justify-between rounded-2xl px-4 py-2 text-sm transition',
                    statusFilter === status
                      ? 'border border-[#4338ca] bg-[#4338ca]/15 text-[#4338ca]'
                      : 'border border-transparent bg-white/85 text-zinc-600 hover:border-[#4338ca]/35 hover:bg-[#4338ca]/10 dark:bg-[#0f172a]/70 dark:text-zinc-300 dark:hover:border-[#6366f1]/45 dark:hover:bg-[#4338ca]/20'
                  )}
                >
                  <span>{STATUS_META[status].label}</span>
                  <span className="font-semibold">{statusCounts[status]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`${SURFACE_CARD_CLASS} flex flex-col gap-4 px-6 py-6`}>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
              Quick actions
            </span>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Jump to common filters the operations team uses every day.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('shipped')}
                className={SOFT_BUTTON_CLASS}
              >
                In transit
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('delivered')}
                className={SOFT_BUTTON_CLASS}
              >
                Delivered
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('canceled')}
                className={SOFT_BUTTON_CLASS}
              >
                Cancellations
              </button>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white/85 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-300">
              Total revenue:{' '}
              <span className="font-semibold text-[#4338ca] dark:text-zinc-100">
                {revenueLabel}
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {loading ? (
            <div
              className={`${SURFACE_CARD_CLASS} flex items-center justify-center gap-3 rounded-4xl p-12 text-zinc-600 dark:text-zinc-300`}
            >
              <Loader2 className="size-5 animate-spin" strokeWidth={1.75} />
              Loading orders…
            </div>
          ) : error ? (
            <div className="rounded-4xl border border-rose-200 bg-rose-50 p-8 text-rose-600 shadow-[0_26px_52px_-32px_rgba(244,63,94,0.25)] dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : totalOrders === 0 ? (
            <div
              className={`${SURFACE_CARD_CLASS} flex flex-col items-center justify-center gap-4 rounded-4xl p-16 text-center text-zinc-600 dark:text-zinc-300`}
            >
              <PackageSearch
                className="size-12 text-zinc-400"
                strokeWidth={1.75}
              />
              <div>
                <h3 className="text-lg font-semibold text-[#0d141c] dark:text-white">
                  No orders yet
                </h3>
                <p className="mt-1 text-sm">
                  Once your first payment clears, it will appear here
                  automatically.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`${SURFACE_CARD_CLASS} hidden overflow-hidden rounded-4xl p-6 md:block`}
              >
                <div className="overflow-x-auto">
                  <div className="mx-auto min-w-[720px] max-w-5xl">
                    <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                    <thead className="text-left text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                      <tr>
                        <th className="py-3">Order</th>
                        <th className="py-3">Customer</th>
                        <th className="py-3">Status</th>
                        <th className="py-3 text-right">Total</th>
                        <th className="py-3 text-right">Date</th>
                        <th className="py-3 text-right">Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                      {orders.map((order) => {
                        const status = isStatus(String(order.status))
                          ? (order.status as NonNullable<Order['status']>)
                          : 'paid'
                        const statusMeta = STATUS_META[status]
                        return (
                          <tr
                            key={order.id}
                            className="hover:bg-zinc-50 dark:hover:bg-[#162038]"
                          >
                            <td className="py-4 font-semibold text-[#0d141c] dark:text-white">
                              #{order.id.slice(-6).toUpperCase()}
                            </td>
                            <td className="py-4 pr-8 text-zinc-500 dark:text-zinc-300">
                              {order.email || order.userId || '—'}
                            </td>
                            <td className="py-4 pl-4">
                              <span className={statusMeta.badgeClass}>
                                {statusMeta.label}
                              </span>
                            </td>
                            <td className="py-4 text-right font-semibold text-[#0d141c] dark:text-white">
                              {formatCurrency(
                                order.amountTotal,
                                order.currency || 'USD'
                              )}
                            </td>
                            <td className="py-4 text-right text-zinc-500 dark:text-zinc-300">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="py-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <select
                                  value={order.status || 'paid'}
                                  onChange={(event) =>
                                    updateStatus(
                                      order.id,
                                      event.target.value as Order['status']
                                    )
                                  }
                                  disabled={saving === order.id}
                                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0d141c] transition focus:border-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-[#0f172a]/80 dark:text-zinc-100"
                                >
                                  {STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {STATUS_META[s].label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white/85 p-2 text-[#4338ca] transition hover:-translate-y-0.5 hover:border-[#4338ca]/40 hover:bg-[#4338ca]/10 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-100"
                                  title="View customer details"
                                >
                                  <ArrowUpRight
                                    className="size-4"
                                    strokeWidth={1.75}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:hidden">
                {orders.map((order) => {
                  const status = isStatus(String(order.status))
                    ? (order.status as NonNullable<Order['status']>)
                    : 'paid'
                  const statusMeta = STATUS_META[status]
                  return (
                    <article
                      key={order.id}
                      className={`${SURFACE_CARD_CLASS} flex flex-col gap-4 px-5 py-5`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                            Order
                          </p>
                          <p className="text-lg font-semibold text-[#0d141c] dark:text-white">
                            #{order.id.slice(-6).toUpperCase()}
                          </p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {order.email || order.userId || '—'}
                          </p>
                        </div>
                        <span
                          className={clsx(
                            statusMeta.badgeClass,
                            'ml-3 text-[0.7rem]'
                          )}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.28em]">
                            Amount
                          </p>
                          <p className="text-base font-semibold text-[#0d141c] dark:text-white">
                            {formatCurrency(
                              order.amountTotal,
                              order.currency || 'USD'
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.28em]">
                            Date
                          </p>
                          <p className="text-base font-semibold text-[#0d141c] dark:text-white">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                          Update status
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={order.status || 'paid'}
                            onChange={(event) =>
                              updateStatus(
                                order.id,
                                event.target.value as Order['status']
                              )
                            }
                            disabled={saving === order.id}
                            className="flex-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0d141c] transition focus:border-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-[#0f172a]/80 dark:text-zinc-100"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_META[s].label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white/85 p-2 text-[#4338ca] transition hover:-translate-y-0.5 hover:border-[#4338ca]/40 hover:bg-[#4338ca]/10 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-100"
                            title="View customer details"
                          >
                            <ArrowUpRight className="size-4" strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
