'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowUpRight,
  Boxes,
  ClipboardList,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { getAllProducts } from '@/lib/products'
import type { Product } from '@/types/product'
import { useAuth } from '@/context/AuthContext'
import { fmtCurrency } from '@/lib/money'

type Order = {
  id: string
  email?: string | null
  amountTotal?: number | null
  status?: string | null
  currency?: string | null
  createdAt?:
    | { seconds?: number; nanoseconds?: number }
    | { _seconds?: number; _nanoseconds?: number }
    | { toDate?: () => Date }
    | string
    | number
    | Date
    | null
}

type ProductStats = {
  total: number
  lowStock: number
  outOfStock: number
  avgPrice: number
}

type OrderStats = {
  totalOrders: number
  openOrders: number
  revenue: number
}

function computeProductStats(products: Product[]): ProductStats {
  if (products.length === 0) {
    return { total: 0, lowStock: 0, outOfStock: 0, avgPrice: 0 }
  }
  let lowStock = 0
  let outOfStock = 0
  let priceAccumulator = 0
  for (const product of products) {
    const stockValue =
      typeof product.stock === 'number' && Number.isFinite(product.stock)
        ? product.stock
        : 0
    if (stockValue === 0) outOfStock += 1
    if (stockValue > 0 && stockValue <= 5) lowStock += 1
    const priceValue =
      typeof product.price === 'number'
        ? product.price
        : Number(product.price) || 0
    priceAccumulator += priceValue
  }
  return {
    total: products.length,
    lowStock,
    outOfStock,
    avgPrice: priceAccumulator / Math.max(products.length, 1),
  }
}

const DASHBOARD_STATUS_STYLES: Record<string, string> = {
  paid: 'admin-chip admin-chip--paid',
  fulfilled: 'admin-chip admin-chip--fulfilled',
  shipped: 'admin-chip admin-chip--shipped',
  delivered: 'admin-chip admin-chip--delivered',
  canceled: 'admin-chip admin-chip--canceled',
}

function computeOrderStats(orders: Order[]): OrderStats {
  if (orders.length === 0) {
    return { totalOrders: 0, openOrders: 0, revenue: 0 }
  }
  let openOrders = 0
  let revenue = 0
  for (const order of orders) {
    const status = (order.status || '').toLowerCase()
    if (status && !['delivered', 'canceled'].includes(status)) {
      openOrders += 1
    }
    const total =
      typeof order.amountTotal === 'number'
        ? order.amountTotal
        : Number(order.amountTotal) || 0
    revenue += total
  }
  return {
    totalOrders: orders.length,
    openOrders,
    revenue,
  }
}

function formatDate(input: Order['createdAt']) {
  if (!input) return '—'
  try {
    let date: Date | null = null

    if (typeof input === 'string' || typeof input === 'number') {
      const parsed = new Date(input)
      date = Number.isNaN(parsed.getTime()) ? null : parsed
    } else if (input instanceof Date) {
      date = input
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
    })
  } catch {
    return '—'
  }
}

export default function AdminHome() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoadingProducts(true)
        const allProducts = await getAllProducts()
        if (!alive) return
        setProducts(allProducts)
      } catch {
        if (!alive) return
        setProducts([])
      } finally {
        if (alive) setLoadingProducts(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoadingOrders(true)
        const token = await user?.getIdToken().catch(() => undefined)
        const res = await fetch('/api/admin/orders', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        })
        if (!alive) return
        if (!res.ok) {
          setOrders([])
          return
        }
        const data = (await res.json()) as { items?: Order[] }
        setOrders(Array.isArray(data.items) ? data.items : [])
      } catch {
        if (!alive) return
        setOrders([])
      } finally {
        if (alive) setLoadingOrders(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [user])

  const productStats = useMemo(() => computeProductStats(products), [products])
  const orderStats = useMemo(() => computeOrderStats(orders), [orders])
  const recentOrders = useMemo(() => orders.slice(0, 6), [orders])
  const primaryCurrency = useMemo(
    () =>
      orders.find((order) => typeof order.currency === 'string')?.currency ||
      'USD',
    [orders]
  )
  const averageOrderValue =
    orderStats.totalOrders > 0
      ? orderStats.revenue / orderStats.totalOrders
      : 0

  return (
    <div className="space-y-8 text-[rgb(var(--admin-text-rgb))]">
      <section className="admin-panel-card admin-panel-card--hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="admin-eyebrow text-[rgba(var(--admin-accent-rgb),0.75)]">
              Overview
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-[2.15rem]">
              Keep your store performance on track
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-[rgb(var(--admin-muted-rgb))]">
              Monitor inventory levels, fulfilment progress, and revenue trends without
              leaving the dashboard. Designed to stay clear and readable across laptop,
              tablet, and mobile screens.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/product/new"
              className="admin-button admin-button--primary"
            >
              <Sparkles className="size-4" strokeWidth={1.75} />
              Add product
            </Link>
            <Link
              href="/admin/orders"
              className="admin-button admin-button--surface"
            >
              Review orders
              <ArrowUpRight className="size-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>

        <dl className="admin-kpi-grid admin-kpi-grid--hero">
          <KpiCard
            label="Catalog size"
            value={productStats.total}
            description="Products currently live"
            loading={loadingProducts}
          />
          <KpiCard
            label="Open orders"
            value={orderStats.openOrders}
            description="Awaiting fulfilment"
            loading={loadingOrders}
          />
          <KpiCard
            label="Total revenue"
            value={fmtCurrency(
              orderStats.revenue,
              primaryCurrency || 'USD'
            )}
            description="Lifetime Stripe earnings"
            loading={loadingOrders}
          />
        </dl>
      </section>

      <section className="admin-panel-grid">
        <div className="admin-panel-card">
          <div className="space-y-2">
            <p className="admin-eyebrow text-[rgba(var(--admin-accent-rgb),0.75)]">
              Quick actions
            </p>
            <h3 className="text-lg font-semibold">Act on what matters now</h3>
            <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
              Jump straight into the workflows you use most and keep operations moving.
            </p>
          </div>
          <div className="admin-action-list">
            <ActionLink
              href="/admin/product"
              icon={<Boxes className="size-4" strokeWidth={1.75} />}
              description="Update product copy, pricing, and availability."
            >
              Review catalog
            </ActionLink>
            <ActionLink
              href="/admin/orders"
              icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
              description="Check payment status and progress orders through fulfilment."
            >
              Manage orders
            </ActionLink>
            <ActionLink
              href="/admin/product/new"
              icon={<TrendingUp className="size-4" strokeWidth={1.75} />}
              description="Publish a new listing or launch a marketing push."
            >
              Launch campaign
            </ActionLink>
          </div>
        </div>

        <div className="admin-panel-card">
          <div className="space-y-2">
            <p className="admin-eyebrow text-[rgba(var(--admin-accent-rgb),0.75)]">
              Inventory watchlist
            </p>
            <h3 className="text-lg font-semibold">Stay ahead of stock issues</h3>
            <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
              Flag low or depleted inventory before it interrupts sales.
            </p>
          </div>
          {loadingProducts ? (
            <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
              Loading stock insights…
            </p>
          ) : productStats.lowStock === 0 && productStats.outOfStock === 0 ? (
            <div className="admin-empty-state admin-empty-state--quiet">
              <p className="text-sm font-medium text-[rgb(var(--admin-text-rgb))]">
                Inventory looks healthy 🎉
              </p>
              <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
                We will surface alerts here as soon as any SKU drops below its safety threshold.
              </p>
            </div>
          ) : (
            <ul className="admin-inventory-issues">
              {productStats.lowStock > 0 && (
                <li className="admin-inventory-issue admin-inventory-issue--warning">
                  <span className="admin-pill admin-pill--warning">
                    {productStats.lowStock}
                  </span>
                  <div>
                    <p className="font-semibold text-[rgb(var(--admin-text-rgb))]">
                      Low stock
                    </p>
                    <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
                      Products are below five units — consider scheduling a restock.
                    </p>
                  </div>
                </li>
              )}
              {productStats.outOfStock > 0 && (
                <li className="admin-inventory-issue admin-inventory-issue--danger">
                  <span className="admin-pill admin-pill--danger">
                    {productStats.outOfStock}
                  </span>
                  <div>
                    <p className="font-semibold text-[rgb(var(--admin-text-rgb))]">
                      Sold out
                    </p>
                    <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
                      Items are unavailable — swap in alternatives or notify suppliers.
                    </p>
                  </div>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="admin-panel-card">
          <div className="space-y-2">
            <p className="admin-eyebrow text-[rgba(var(--admin-accent-rgb),0.75)]">
              Store pulse
            </p>
            <h3 className="text-lg font-semibold">Track performance at a glance</h3>
            <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
              Metrics refresh as soon as Stripe syncs and Firestore data updates.
            </p>
          </div>
          <div className="admin-mini-stat-grid">
            <MiniStat
              label="Total orders"
              value={
                loadingOrders ? '—' : orderStats.totalOrders.toLocaleString()
              }
            />
            <MiniStat
              label="Average order value"
              value={
                loadingOrders
                  ? '—'
                  : fmtCurrency(
                      averageOrderValue,
                      primaryCurrency || 'USD'
                    )
              }
            />
            <MiniStat
              label="Live products"
              value={
                loadingProducts ? '—' : productStats.total.toLocaleString()
              }
            />
            <MiniStat
              label="Out of stock"
              tone="danger"
              value={
                loadingProducts ? '—' : productStats.outOfStock.toString()
              }
            />
            <MiniStat
              label="Low inventory"
              tone="warning"
              value={
                loadingProducts ? '—' : productStats.lowStock.toString()
              }
            />
            <MiniStat
              label="Avg. product price"
              value={
                loadingProducts
                  ? '—'
                  : fmtCurrency(productStats.avgPrice, primaryCurrency || 'USD')
              }
            />
          </div>
        </div>
      </section>

      <section className="admin-panel-card admin-panel-card--table">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="admin-eyebrow text-[rgba(var(--admin-accent-rgb),0.75)]">
              Latest orders
            </p>
            <h3 className="text-lg font-semibold">Recent activity from Stripe</h3>
            <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
              Review payments and fulfilment progress as soon as they sync.
            </p>
          </div>
          <Link href="/admin/orders" className="admin-button admin-button--surface">
            View all orders
            <ArrowUpRight className="size-4" strokeWidth={1.75} />
          </Link>
        </div>
        <div className="mt-6 admin-table-shell">
          <div className="hidden sm:block">
            <div className="admin-table-scroll">
              <table className="admin-table min-w-[640px] text-sm">
                <thead className="admin-table-head text-left text-xs uppercase">
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="admin-table-body">
                  {loadingOrders ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-[rgb(var(--admin-muted-rgb))]"
                      >
                        Loading latest orders…
                      </td>
                    </tr>
                  ) : recentOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-[rgb(var(--admin-muted-rgb))]"
                      >
                        No orders yet. Your first sale will show up right here.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id} className="admin-table-row">
                        <td className="font-semibold">
                          #{order.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="text-[rgb(var(--admin-muted-rgb))]">
                          {order.email || '—'}
                        </td>
                        <td>
                          <span
                            className={
                              DASHBOARD_STATUS_STYLES[
                                (order.status || 'paid').toLowerCase()
                              ] ?? 'admin-chip admin-chip--paid'
                            }
                          >
                            {(order.status || 'paid').toUpperCase()}
                          </span>
                        </td>
                        <td className="text-right font-semibold">
                          {fmtCurrency(
                            typeof order.amountTotal === 'number'
                              ? order.amountTotal
                              : Number(order.amountTotal) || 0,
                            order.currency || primaryCurrency || 'USD'
                          )}
                        </td>
                        <td className="text-right text-[rgb(var(--admin-muted-rgb))]">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:hidden">
            {loadingOrders ? (
              <div className="rounded-2xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] p-4 text-sm text-[rgb(var(--admin-muted-rgb))]">
                Loading latest orders…
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="rounded-2xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] p-4 text-sm text-[rgb(var(--admin-muted-rgb))]">
                No orders yet. Your first sale will show up right here.
              </div>
            ) : (
              recentOrders.map((order) => {
                const statusClass =
                  DASHBOARD_STATUS_STYLES[
                    (order.status || 'paid').toLowerCase()
                  ] ?? 'admin-chip admin-chip--paid'
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
                          {order.email || '—'}
                        </p>
                      </div>
                      <span className={`${statusClass} text-[0.62rem]`}>
                        {(order.status || 'paid').toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-[rgb(var(--admin-muted-rgb))]">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(var(--admin-muted-rgb),0.72)]">
                          Total
                        </p>
                        <p className="text-base font-semibold text-[var(--foreground)]">
                          {fmtCurrency(
                            typeof order.amountTotal === 'number'
                              ? order.amountTotal
                              : Number(order.amountTotal) || 0,
                            order.currency || primaryCurrency || 'USD'
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(var(--admin-muted-rgb),0.72)]">
                          Date
                        </p>
                        <p className="text-base font-semibold text-[var(--foreground)]">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function ActionLink({
  href,
  icon,
  children,
  description,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
  description?: ReactNode
}) {
  return (
    <Link href={href} className="admin-quick-link">
      <span className="admin-quick-link-icon">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold tracking-tight">
          {children}
        </span>
        {description ? (
          <span className="mt-1 block text-xs text-[rgb(var(--admin-muted-rgb))]">
            {description}
          </span>
        ) : null}
      </span>
      <ArrowUpRight className="admin-quick-link-chevron" strokeWidth={1.75} />
    </Link>
  )
}

function KpiCard({
  label,
  value,
  description,
  loading,
}: {
  label: string
  value: ReactNode
  description: ReactNode
  loading?: boolean
}) {
  return (
    <div className="admin-kpi-card">
      <dt className="admin-kpi-label">{label}</dt>
      <dd className="admin-kpi-value">{loading ? '—' : value}</dd>
      <p className="admin-kpi-description">{description}</p>
    </div>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'warning' | 'danger'
}) {
  return (
    <div
      className={`admin-mini-stat ${
        tone === 'danger'
          ? 'admin-mini-stat--danger'
          : tone === 'warning'
          ? 'admin-mini-stat--warning'
          : ''
      }`}
    >
      <p className="admin-mini-stat-label">{label}</p>
      <p className="admin-mini-stat-value">{value}</p>
    </div>
  )
}
