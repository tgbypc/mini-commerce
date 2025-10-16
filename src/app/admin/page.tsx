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
  paid: 'inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  fulfilled:
    'inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  shipped:
    'inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  delivered:
    'inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  canceled:
    'inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
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
    orderStats.totalOrders > 0 ? orderStats.revenue / orderStats.totalOrders : 0

  const heroSurfaceClass =
    'rounded-4xl border border-zinc-200 bg-white/95 shadow-[0_32px_56px_-30px_rgba(15,23,42,0.28)] dark:border-zinc-700 dark:bg-[#111827]'
  const surfaceCardClass =
    'rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_26px_52px_-32px_rgba(15,23,42,0.22)] dark:border-zinc-700 dark:bg-[#0f172a]'

  return (
    <div className="relative overflow-hidden bg-[#f6f7fb] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <span
        className="pointer-events-none absolute -left-[18%] top-16 size-[320px] rounded-full bg-[rgba(124,58,237,0.15)] blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-8 right-[-22%] size-[360px] rounded-full bg-[rgba(59,130,246,0.14)] blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section
          className={`${heroSurfaceClass} relative overflow-hidden px-6 py-12 sm:px-10`}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-[-18%] hidden w-[50%] rounded-full bg-gradient-to-br from-[#dbe7ff] via-transparent to-transparent blur-3xl sm:block"
            aria-hidden
          />
          <div className="relative z-[1] flex flex-col gap-10 lg:grid lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f6f7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:border-zinc-700 dark:bg-[#1f2937] dark:text-zinc-300">
                Overview
              </span>
              <h2 className="text-3xl font-semibold text-[#0d141c] md:text-4xl dark:text-white">
                Store performance snapshot
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                Keep an eye on inventory, fulfilment and revenue trends from a
                single dashboard. The layout stays clear from desktop down to
                mobile.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/admin/product/new" className="btn-primary gap-2">
                  <Sparkles className="size-4" strokeWidth={1.75} />
                  Add product
                </Link>
                <Link href="/admin/orders" className="btn-outline gap-2">
                  Review orders
                  <ArrowUpRight className="size-4" strokeWidth={1.75} />
                </Link>
              </div>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
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
              <KpiCard
                label="Avg. order value"
                value={fmtCurrency(averageOrderValue, primaryCurrency || 'USD')}
                description="Revenue ÷ total orders"
                loading={loadingOrders}
              />
            </dl>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className={`${surfaceCardClass} flex flex-col gap-6 p-6`}>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                Quick actions
              </p>
              <h3 className="text-lg font-semibold text-[#0d141c] dark:text-white">
                Act on what matters now
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Jump into the workflows you use most and keep operations moving.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ActionLink
                href="/admin/product"
                icon={<Boxes className="size-4" strokeWidth={1.75} />}
                description="Update product descriptions, pricing and availability."
              >
                Review catalog
              </ActionLink>
              <ActionLink
                href="/admin/orders"
                icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
                description="Check payment status and move orders forward."
              >
                Manage orders
              </ActionLink>
              <ActionLink
                href="/admin/messages"
                icon={<Sparkles className="size-4" strokeWidth={1.75} />}
                description="Follow up on customer messages from a single inbox."
              >
                Open messages
              </ActionLink>
              <ActionLink
                href="/admin/product/new"
                icon={<TrendingUp className="size-4" strokeWidth={1.75} />}
                description="Publish a new listing or schedule a campaign."
              >
                Launch campaign
              </ActionLink>
            </div>
          </div>

          <div className={`${surfaceCardClass} flex flex-col gap-6 p-6`}>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                Inventory watchlist
              </p>
              <h3 className="text-lg font-semibold text-[#0d141c] dark:text-white">
                Stay ahead of stock issues
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Surface low or depleted inventory before it impacts sales.
              </p>
            </div>
            {loadingProducts ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading stock insights…
              </p>
            ) : productStats.lowStock === 0 && productStats.outOfStock === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-[#f8f9fc] px-4 py-5 text-sm text-[#0d141c] shadow-inner dark:border-zinc-700 dark:bg-[#101828] dark:text-zinc-100">
                Inventory looks healthy 🎉
              </div>
            ) : (
              <ul className="space-y-3">
                {productStats.lowStock > 0 && (
                  <li className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                    <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold tracking-[0.2em] text-amber-700 dark:bg-amber-500/25 dark:text-amber-100">
                      {productStats.lowStock}
                    </span>
                    <span>
                      <strong className="block text-[#0d141c] dark:text-white">
                        Low stock
                      </strong>
                      Products are below five units — plan a restock.
                    </span>
                  </li>
                )}
                {productStats.outOfStock > 0 && (
                  <li className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200">
                    <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold tracking-[0.2em] text-rose-700 dark:bg-rose-500/25 dark:text-rose-100">
                      {productStats.outOfStock}
                    </span>
                    <span>
                      <strong className="block text-rose-700 dark:text-rose-100">
                        Sold out
                      </strong>
                      Items are unavailable — notify suppliers or replace SKUs.
                    </span>
                  </li>
                )}
              </ul>
            )}
          </div>

          <div
            className={`${surfaceCardClass} flex flex-col gap-6 p-6 lg:col-span-2`}
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                Store pulse
              </p>
              <h3 className="text-lg font-semibold text-[#0d141c] dark:text-white">
                Track performance at a glance
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Metrics refresh automatically as soon as Stripe and Firestore
                sync.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    : fmtCurrency(averageOrderValue, primaryCurrency || 'USD')
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
                value={loadingProducts ? '—' : productStats.lowStock.toString()}
              />
              <MiniStat
                label="Avg. product price"
                value={
                  loadingProducts
                    ? '—'
                    : fmtCurrency(
                        productStats.avgPrice,
                        primaryCurrency || 'USD'
                      )
                }
              />
            </div>
          </div>
        </section>

        <section className={`${surfaceCardClass} flex flex-col gap-6 p-6`}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                Latest orders
              </p>
              <h3 className="text-lg font-semibold text-[#0d141c] dark:text-white">
                Recent activity from Stripe
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Payments and fulfilment statuses sync in near real time.
              </p>
            </div>
            <Link href="/admin/orders" className="btn-outline gap-2">
              View all orders
              <ArrowUpRight className="size-4" strokeWidth={1.75} />
            </Link>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <div className="mx-auto min-w-[640px] max-w-5xl">
              <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                <thead className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3 pr-4 text-left">Order</th>
                    <th className="py-3 px-4 text-left">Customer</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 pl-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {loadingOrders ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-zinc-500 dark:text-zinc-400"
                      >
                        Loading latest orders…
                      </td>
                    </tr>
                  ) : recentOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-zinc-500 dark:text-zinc-400"
                      >
                        No orders yet. Your first sale will show up right here.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-zinc-50 dark:hover:bg-[#162038]"
                      >
                        <td className="py-4 pr-4 font-semibold text-[#0d141c] dark:text-white">
                          #{order.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="py-4 px-4 text-zinc-500 dark:text-zinc-300">
                          {order.email || '—'}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={
                              DASHBOARD_STATUS_STYLES[
                                (order.status || 'paid').toLowerCase()
                              ] ?? DASHBOARD_STATUS_STYLES.paid
                            }
                          >
                            {(order.status || 'paid').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 text-right font-semibold text-[#0d141c] dark:text-white">
                          {fmtCurrency(
                            typeof order.amountTotal === 'number'
                              ? order.amountTotal
                              : Number(order.amountTotal) || 0,
                            order.currency || primaryCurrency || 'USD'
                          )}
                        </td>
                        <td className="py-4 pl-4 text-right text-zinc-500 dark:text-zinc-300">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-3 md:hidden">
            {loadingOrders ? (
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-[#101828] dark:text-zinc-300">
                Loading latest orders…
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-[#101828] dark:text-zinc-300">
                No orders yet. Your first sale will show up right here.
              </div>
            ) : (
              recentOrders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] dark:border-zinc-700 dark:bg-[#101828] dark:text-zinc-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                        Order
                      </p>
                      <p className="text-lg font-semibold text-[#0d141c] dark:text-white">
                        #{order.id.slice(-6).toUpperCase()}
                      </p>
                      <p className="mt-1 text-zinc-500 dark:text-zinc-300">
                        {order.email || '—'}
                      </p>
                    </div>
                    <span
                      className={
                        DASHBOARD_STATUS_STYLES[
                          (order.status || 'paid').toLowerCase()
                        ] ?? DASHBOARD_STATUS_STYLES.paid
                      }
                    >
                      {(order.status || 'paid').toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-500 dark:text-zinc-300">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                        Total
                      </p>
                      <p className="text-base font-semibold text-[#0d141c] dark:text-white">
                        {fmtCurrency(
                          typeof order.amountTotal === 'number'
                            ? order.amountTotal
                            : Number(order.amountTotal) || 0,
                          order.currency || primaryCurrency || 'USD'
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                        Date
                      </p>
                      <p className="text-base font-semibold text-[#0d141c] dark:text-white">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
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
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-left shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(15,23,42,0.22)] dark:border-zinc-700 dark:bg-[#101828]"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4338ca] shadow-sm dark:bg-[#1e2337] dark:text-indigo-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#0d141c] dark:text-white">
          {children}
        </span>
        {description ? (
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-300">
            {description}
          </span>
        ) : null}
      </span>
      <ArrowUpRight
        className="size-4 shrink-0 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-[#4338ca] dark:text-zinc-500"
        strokeWidth={1.75}
      />
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
    <div className="space-y-2 rounded-3xl border border-zinc-200 bg-white px-5 py-6 shadow-[0_24px_48px_-32px_rgba(15,23,42,0.22)] dark:border-zinc-700 dark:bg-[#101828]">
      <dt className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="text-2xl font-semibold text-[#0d141c] dark:text-white">
        {loading ? '—' : value}
      </dd>
      <p className="text-sm text-zinc-500 dark:text-zinc-300">{description}</p>
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
  const base =
    'rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] dark:border-zinc-700 dark:bg-[#101828]'
  const toneClass =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200'
      : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200'
      : 'text-[#0d141c] dark:text-white'
  return (
    <div className={`${base} ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}
