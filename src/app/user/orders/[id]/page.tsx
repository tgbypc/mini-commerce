'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Timestamp } from 'firebase/firestore'
import { useRouter, useParams } from 'next/navigation'
import { fmtCurrency } from '@/lib/money'
import { useAuth } from '@/context/AuthContext'

const fmt = (n: number | null | undefined, c = 'USD') => fmtCurrency(n ?? 0, c)

function resolveDate(value: OrderDetail['createdAt']) {
  if (typeof value === 'string') return new Date(value)
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  if (value && typeof value === 'object') {
    const seconds =
      typeof (value as { seconds?: number }).seconds === 'number'
        ? (value as { seconds?: number }).seconds
        : typeof (value as { _seconds?: number })._seconds === 'number'
        ? (value as { _seconds?: number })._seconds
        : undefined
    const nanos =
      typeof (value as { nanoseconds?: number }).nanoseconds === 'number'
        ? (value as { nanoseconds?: number }).nanoseconds
        : typeof (value as { _nanoseconds?: number })._nanoseconds === 'number'
        ? (value as { _nanoseconds?: number })._nanoseconds
        : 0
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000 + Math.floor((nanos ?? 0) / 1e6))
    }
  }
  return null
}

type LineItem = {
  productId: string | null
  description?: string
  quantity: number
  unitAmount: number | null
  currency: string
  thumbnail?: string | null
}

type ShippingAddress = {
  line1?: string | null
  line2?: string | null
  postal_code?: string | null
  city?: string | null
  town?: string | null
  state?: string | null
  country?: string | null
}

type ShippingInfo = {
  method?: string | null
  amountTotal?: number | null
  address?: ShippingAddress | null
  name?: string | null
} | null

type OrderDetail = {
  id: string
  sessionId?: string
  amountTotal?: number | null
  currency?: string | null
  paymentStatus?: string | null
  status?: 'paid' | 'fulfilled' | 'shipped' | 'delivered' | 'canceled'
  shipping?: ShippingInfo
  createdAt?: Timestamp | Date | null
  items?: LineItem[]
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<OrderDetail | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (authLoading || !user || !orderId) return
      try {
        setLoading(true)
        const token = await user.getIdToken()
        const res = await fetch(`/api/user/orders/${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Order fetch failed')
        const data = (await res.json()) as OrderDetail
        if (!cancelled) setOrder(data)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, orderId])

  const dateInfo = useMemo(() => {
    if (!order) return { when: '', iso: '', date: null as Date | null }
    const date = resolveDate(order.createdAt)
    return {
      date,
      when: date ? date.toLocaleString(undefined) : '',
      iso: date ? date.toISOString() : '',
    }
  }, [order])

  if (!user && !authLoading) {
    return (
      <div className="min-h-[60vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-zinc-200 bg-white/90 px-6 py-10 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-[#0d141c]">Order</h1>
          <p className="mt-2 text-sm text-zinc-600">You need to sign in to view this order.</p>
          <Link
            href="/user/login"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0d141c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2a37]"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-[40vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto grid w-full max-w-5xl gap-6">
          <div className="h-48 rounded-3xl border border-zinc-200 bg-white/80 shadow animate-pulse" />
          <div className="h-72 rounded-3xl border border-zinc-200 bg-white/75 shadow animate-pulse" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-[40vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-zinc-200 bg-white/90 px-6 py-10 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-[#0d141c]">Order</h1>
          <p className="mt-2 text-sm text-zinc-600">We couldn’t find that order. It might have been removed or you don’t have permission to view it.</p>
          <Link
            href="/user/orders"
            className="mt-6 inline-flex items-center justify-center rounded-full border border-zinc-200 px-5 py-2 text-sm font_medium text-[#0d141c] transition hover:bg-white"
          >
            Back to orders
          </Link>
        </div>
      </div>
    )
  }

  const currency = (order.currency ?? 'USD').toUpperCase()
  const steps: Array<{ key: NonNullable<OrderDetail['status']>; label: string; icon: string }> = [
    { key: 'paid', label: 'Payment confirmed', icon: '💳' },
    { key: 'fulfilled', label: 'Processing', icon: '📦' },
    { key: 'shipped', label: 'Shipped', icon: '🚚' },
    { key: 'delivered', label: 'Delivered', icon: '🏡' },
  ]
  const statusKey = (order.status || 'paid') as (typeof steps)[number]['key']
  const activeIdx = steps.findIndex((s) => s.key === statusKey)

  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.unitAmount ?? 0) * Number(item.quantity ?? 0)),
    0
  )
  const shipping = order.shipping?.amountTotal || 0

  return (
    <div className="bg-[#f6f7fb] px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)] md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f4f4f5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-600">
                Order #{order.id}
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-[#0d141c]">Order summary</h1>
              {dateInfo.when && (
                <p className="text-sm text-zinc-600">Placed on {dateInfo.when}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 text-sm text-zinc-600 md:text-right">
              <span className="inline-flex items-center justify-end rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-[#0d141c]">
                {fmt(order.amountTotal ?? 0, currency)} total
              </span>
              {order.sessionId && <span className="text-xs">Session: {order.sessionId}</span>}
              <Link
                href="/user/orders"
                className="inline-flex items-center justify-end rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium text-[#0d141c] transition hover:bg-white"
              >
                Back to orders
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_16px_32px_rgba(15,23,42,0.06)] md:px-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-600">Status</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {steps.map((step, index) => {
              const active = index <= activeIdx
              return (
                <div
                  key={step.key}
                  className={`flex flex-col rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    active
                      ? 'border-[#0d141c]/40 bg-[#0d141c]/5 text-[#0d141c]'
                      : 'border-zinc-200 bg-[#f6f7fb] text-zinc-500'
                  }`}
                >
                  <span className="text-lg">{step.icon}</span>
                  <span className="mt-2">{step.label}</span>
                  {active && index === activeIdx && <span className="mt-1 text-xs font-semibold uppercase text-[#0d141c]">Current</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_16px_32px_rgba(15,23,42,0.06)] md:px-8">
            <h2 className="text-lg font-semibold text-[#0d141c]">Items</h2>
            {order.items && order.items.length ? (
              <ul className="mt-4 divide-y divide-zinc-200">
                {order.items.map((item, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail}
                          alt={item.description || 'Product'}
                          className="size-14 rounded-2xl border border-zinc-200 object-cover"
                        />
                      ) : (
                        <div className="size-14 rounded-2xl border border-zinc-200 bg-[#f4f4f5]" />
                      )}
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-[#0d141c]">
                          {item.description || item.title || 'Product'}
                        </div>
                        <div className="text-xs text-zinc-500">× {Number(item.quantity ?? 0) || 0}</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-[#0d141c]">
                      {fmt((item.unitAmount ?? 0) * (item.quantity ?? 0), currency)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-zinc-600">No items found for this order.</p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_16px_32px_rgba(15,23,42,0.06)]">
              <h2 className="text-lg font-semibold text-[#0d141c]">Payment summary</h2>
              <div className="mt-4 space-y-2 text-sm text-[#0d141c]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Subtotal</span>
                  <span className="font-medium">{fmt(subtotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Shipping{order.shipping?.method ? ` (${order.shipping.method})` : ''}</span>
                  <span className="font-medium">{fmt(shipping, currency)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-zinc-200 pt-2 text-base font-semibold">
                  <span>Total paid</span>
                  <span>{fmt(order.amountTotal ?? 0, currency)}</span>
                </div>
              </div>
            </div>

            {order.shipping?.address && (
              <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_16px_32px_rgba(15,23,42,0.06)]">
                <h2 className="text-lg font-semibold text-[#0d141c]">Shipping address</h2>
                {(() => {
                  const address = order.shipping?.address
                  if (!address) return null
                  const first = [address.line1, address.line2].filter(Boolean).join(' ')
                  const second = [address.postal_code, address.city || address.town, address.state].filter(Boolean).join(' ')
                  return (
                    <div className="mt-3 text-sm text-zinc-600">
                      {order.shipping?.name && <div className="font_medium text-[#0d141c]">{order.shipping.name}</div>}
                      {first && <div>{first}</div>}
                      {second && <div>{second}</div>}
                      {address.country && <div>{address.country}</div>}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
