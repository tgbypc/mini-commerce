'use client'

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

const STATUS_STYLES: Record<
  NonNullable<Order['status']>,
  { label: string; className: string }
> = {
  paid: {
    label: 'Paid',
    className: 'admin-chip admin-chip--paid',
  },
  fulfilled: {
    label: 'Fulfilled',
    className: 'admin-chip admin-chip--fulfilled',
  },
  shipped: {
    label: 'Shipped',
    className: 'admin-chip admin-chip--shipped',
  },
  delivered: {
    label: 'Delivered',
    className: 'admin-chip admin-chip--delivered',
  },
  canceled: {
    label: 'Canceled',
    className: 'admin-chip admin-chip--canceled',
  },
}

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
    if (typeof input === 'object' && input && 'seconds' in input) {
      const seconds = Number((input as { seconds?: number }).seconds)
      if (!Number.isFinite(seconds)) return '—'
      return new Date(seconds * 1000).toLocaleString()
    }
    const date = new Date(input as string | number)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
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

  return (
    <div className="admin-content-wrapper">
      <div className="space-y-8 text-[var(--foreground)]">
        <header className="admin-section flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-blue-600/60">
              Fulfillment
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Orders
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--admin-muted-rgb))]">
              Track payment status, update fulfillment, and keep shipping notes
              aligned with your logistics workflow.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-[rgba(var(--admin-border-rgb),0.28)] bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--admin-text-rgb))] shadow-[0_18px_38px_-24px_rgba(var(--admin-shadow-rgb),0.28)] sm:w-auto sm:flex-nowrap sm:justify-start">
              <PackageSearch className="size-4 text-[rgba(var(--admin-accent-rgb),0.78)]" strokeWidth={1.75} />
              <span>{orders.length} orders</span>
              <span className="mx-2 h-4 w-px bg-[rgba(var(--admin-border-rgb),0.15)]" />
              <span>{pendingOrders} pending</span>
              <span className="mx-2 h-4 w-px bg-[rgba(var(--admin-border-rgb),0.15)]" />
              <span>{formatCurrency(totalRevenue)}</span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="admin-button admin-button--surface w-full justify-center gap-2 text-sm uppercase tracking-[0.24em] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <RefreshCcw className="size-4" strokeWidth={1.75} />
              )}
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        <div className="admin-section flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(var(--admin-muted-rgb),0.8)]">
              Status filter
            </div>
            <label className="w-full sm:max-w-xs lg:w-72">
              <span className="sr-only">Filter orders by status</span>
              <div className="relative flex items-center gap-2 rounded-2xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.92)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-within:border-blue-400/45 focus-within:shadow-[0_18px_36px_-24px_rgba(59,130,246,0.5)]">
                <Filter className="size-4 text-[rgba(var(--admin-accent-rgb),0.7)]" strokeWidth={1.75} />
                <select
                  value={statusFilter || ''}
                  onChange={(event) => {
                    const value = event.target.value
                    setStatusFilter(
                      value === '' ? '' : isStatus(value) ? value : ''
                    )
                  }}
                  className="w-full appearance-none bg-transparent pr-6 text-sm font-medium text-[var(--foreground)] focus:outline-none"
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_STYLES[status].label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 size-4 text-[rgba(var(--admin-muted-rgb),0.75)]" />
              </div>
            </label>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex animate-pulse items-center gap-4 rounded-2xl admin-card-soft px-4 py-3"
                >
                  <div className="h-6 w-20 rounded bg-[rgba(var(--admin-border-rgb),0.12)]" />
                  <div className="h-6 w-32 rounded bg-[rgba(var(--admin-border-rgb),0.08)]" />
                  <div className="h-6 w-24 rounded bg-[rgba(var(--admin-border-rgb),0.08)]" />
                  <div className="h-6 w-24 rounded bg-[rgba(var(--admin-border-rgb),0.08)]" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-500/12 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl admin-card-soft px-4 py-6 text-sm text-[rgb(var(--admin-muted-rgb))]">
              No orders match this filter yet. Once your first purchase is
              completed, it will appear here automatically.
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <div className="admin-table-shell">
                  <div className="admin-table-scroll">
                    <table className="admin-table min-w-[720px] text-sm">
                      <thead className="admin-table-head text-left text-xs uppercase">
                        <tr>
                          <th>Order</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th className="text-right">Amount</th>
                          <th className="text-right">Placed</th>
                          <th className="text-right">Update</th>
                        </tr>
                      </thead>
                      <tbody className="admin-table-body">
                        {orders.map((order) => {
                          const status = order.status ?? 'paid'
                          const style =
                            STATUS_STYLES[status] ?? STATUS_STYLES.paid
                          return (
                            <tr key={order.id} className="admin-table-row">
                              <td className="font-semibold">
                                #{order.id.slice(-6).toUpperCase()}
                              </td>
                              <td className="text-sm text-[rgb(var(--admin-muted-rgb))]">
                                {order.email || order.userId || '—'}
                              </td>
                              <td>
                                <span className={style.className}>
                                  {style.label}
                                </span>
                              </td>
                              <td className="text-right font-semibold">
                                {formatCurrency(
                                  order.amountTotal,
                                  order.currency || 'USD'
                                )}
                              </td>
                              <td className="text-right text-sm text-[rgb(var(--admin-muted-rgb))]">
                                {formatDate(order.createdAt)}
                              </td>
                              <td className="text-right">
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
                                    className="rounded-xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.9)] px-3 py-1.5 text-xs text-[var(--foreground)] focus:border-blue-400/45 focus:outline-none focus:ring-0"
                                  >
                                    {STATUSES.map((s) => (
                                      <option key={s} value={s}>
                                        {STATUS_STYLES[s].label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.92)] p-2 text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12"
                                    title="View customer record"
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
              <div className="grid gap-3 md:hidden">
                {orders.map((order) => {
                  const status = order.status ?? 'paid'
                  const style = STATUS_STYLES[status] ?? STATUS_STYLES.paid
                  return (
                    <article
                      key={order.id}
                      className="rounded-2xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.96)] p-4 text-sm shadow-[0_18px_38px_-26px_rgba(15,23,42,0.55)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[rgba(var(--admin-muted-rgb),0.72)]">
                            Order
                          </p>
                          <p className="text-lg font-semibold text-[var(--foreground)]">
                            #{order.id.slice(-6).toUpperCase()}
                          </p>
                          <p className="mt-1 text-[rgb(var(--admin-muted-rgb))]">
                            {order.email || order.userId || '—'}
                          </p>
                        </div>
                        <span className={`${style.className} text-[0.62rem]`}>
                          {style.label.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-[rgb(var(--admin-muted-rgb))]">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(var(--admin-muted-rgb),0.72)]">
                            Amount
                          </p>
                          <p className="text-base font-semibold text-[var(--foreground)]">
                            {formatCurrency(
                              order.amountTotal,
                              order.currency || 'USD'
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(var(--admin-muted-rgb),0.72)]">
                            Placed
                          </p>
                          <p className="text-base font-semibold text-[var(--foreground)]">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(var(--admin-muted-rgb),0.72)]">
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
                            className="flex-1 rounded-xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.92)] px-3 py-1.5 text-xs text-[var(--foreground)] focus:border-blue-400/45 focus:outline-none focus:ring-0"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_STYLES[s].label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.92)] p-2 text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12"
                            title="View customer record"
                          >
                            <ArrowUpRight
                              className="size-4"
                              strokeWidth={1.75}
                            />
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
