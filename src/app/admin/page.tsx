'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowUpRight, Boxes, ClipboardList, Sparkles, TrendingUp } from 'lucide-react'
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
  createdAt?: { seconds: number; nanoseconds: number }
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
  fulfilled: 'admin-chip admin-chip--progress',
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

function formatDate(timestamp?: { seconds: number; nanoseconds: number }) {
  if (!timestamp) return '—'
  try {
    const date = new Date(timestamp.seconds * 1000)
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

  const productStats = useMemo(
    () => computeProductStats(products),
    [products]
  )
  const orderStats = useMemo(() => computeOrderStats(orders), [orders])
  const recentOrders = useMemo(() => orders.slice(0, 6), [orders])
  const primaryCurrency = useMemo(
    () => orders.find((order) => typeof order.currency === 'string')?.currency || 'USD',
    [orders]
  )

  return (
    <div className="space-y-8 text-[rgb(var(--admin-text-rgb))]">
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="relative overflow-hidden admin-section admin-hero">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18)_0,rgba(59,130,246,0)_65%)]" />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-blue-600/70">
                Welcome back
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Keep your storefront running smoothly
              </h2>
              <p className="mt-3 max-w-xl text-sm text-[rgb(var(--admin-muted-rgb))]">
                Monitor product health, review customer orders, and push updates
                without leaving this panel. Everything you need for the final
                project demo lives here.
              </p>
            </div>
            <Link
              href="/admin/product/new"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-blue-500/25 bg-blue-500/12 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-500/45 hover:bg-blue-500/20"
            >
              <Sparkles className="size-4" strokeWidth={1.75} />
              Launch product
            </Link>
          </div>
          <div className="admin-metric-grid mt-6 border-t admin-border pt-6 sm:grid-cols-3">
            <div className="admin-metric-card space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-blue-600/60">
                Catalog size
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {loadingProducts ? '—' : productStats.total}
              </p>
              <p className="mt-1 text-xs text-[rgb(var(--admin-muted-rgb))]">
                Products currently live
              </p>
            </div>
            <div className="admin-metric-card space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-blue-600/60">
                Open orders
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {loadingOrders ? '—' : orderStats.openOrders}
              </p>
              <p className="mt-1 text-xs text-[rgb(var(--admin-muted-rgb))]">Need fulfillment</p>
            </div>
            <div className="admin-metric-card space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-blue-600/60">
                Revenue
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {loadingOrders ? '—' : fmtCurrency(orderStats.revenue, primaryCurrency || 'USD')}
              </p>
              <p className="mt-1 text-xs text-[rgb(var(--admin-muted-rgb))]">
                Lifetime from Stripe
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="admin-section space-y-4">
            <p className="text-xs uppercase tracking-[0.32em] text-blue-600/60">
              Quick actions
            </p>
            <div className="mt-4 space-y-3">
              <ActionLink href="/admin/product" icon={<Boxes className="size-4" strokeWidth={1.75} />}>
                Review catalog
              </ActionLink>
              <ActionLink href="/admin/orders" icon={<ClipboardList className="size-4" strokeWidth={1.75} />}>
                Fulfill orders
              </ActionLink>
              <ActionLink href="/admin/product/new" icon={<TrendingUp className="size-4" strokeWidth={1.75} />}>
                Launch campaign
              </ActionLink>
            </div>
          </div>
          <div className="admin-section space-y-4">
            <p className="text-xs uppercase tracking-[0.32em] text-blue-600/60">
              Inventory watchlist
            </p>
            {loadingProducts ? (
              <p className="mt-4 text-sm text-[rgb(var(--admin-muted-rgb))]">Loading…</p>
            ) : productStats.lowStock === 0 && productStats.outOfStock === 0 ? (
              <p className="mt-4 text-sm text-[rgb(var(--admin-muted-rgb))]">
                All products look healthy 🎉
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm text-[rgb(var(--admin-muted-rgb))]">
                {productStats.lowStock > 0 && (
                  <li>
                    <span className="admin-tag-mini admin-tag-mini--warning">
                      {productStats.lowStock}
                    </span>{' '}
                    items below five units
                  </li>
                )}
                {productStats.outOfStock > 0 && (
                  <li>
                    <span className="admin-tag-mini admin-tag-mini--danger">
                      {productStats.outOfStock}
                    </span>{' '}
                    items sold out — restock soon
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="admin-section">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold">Latest orders</h3>
            <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
              Recent payments pulled directly from Stripe sync.
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-sm font-semibold text-blue-600 transition hover:border-blue-400/40 hover:bg-blue-500/20"
          >
            View all
            <ArrowUpRight className="size-4" strokeWidth={1.75} />
          </Link>
        </div>
        <div className="mt-5 admin-table-shell">
          <table className="admin-table min-w-full text-sm">
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
                  <td colSpan={5} className="py-6 text-center text-[rgb(var(--admin-muted-rgb))]">
                    Loading orders…
                  </td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[rgb(var(--admin-muted-rgb))]">
                    No orders yet. Your first sale will appear here.
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
                          DASHBOARD_STATUS_STYLES[(order.status || 'paid').toLowerCase()] ??
                          'admin-chip admin-chip--paid'
                        }
                      >
                        {(order.status || 'paid').toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right font-semibold">
                      {fmtCurrency(
                        typeof order.amountTotal === 'number'
                          ? order.amountTotal
                          : Number(order.amountTotal) || 0
                      , order.currency || primaryCurrency || 'USD')}
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
      </section>
    </div>
  )
}

function ActionLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="admin-quick-link text-sm font-semibold"
    >
      <span className="flex items-center gap-3">
        <span className="admin-quick-link-icon">
          {icon}
        </span>
        <span>{children}</span>
      </span>
      <ArrowUpRight className="admin-quick-link-chevron" strokeWidth={1.75} />
    </Link>
  )
}
