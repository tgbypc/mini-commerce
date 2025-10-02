'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Timestamp } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

type OrderItem = {
  description?: string
  title?: string | null
  quantity: number
  amountSubtotal?: number
  amountTotal?: number
  priceId?: string | null
}

type OrderDoc = {
  id: string
  sessionId?: string
  amountTotal?: number | null
  currency?: string | null
  paymentStatus?: string | null
  status?: string | null
  createdAt?:
    | Timestamp
    | Date
    | { seconds?: number; nanoseconds?: number }
    | { _seconds?: number; _nanoseconds?: number }
    | null
  items?: OrderItem[]
}

const fmtMajor = (amountMajor = 0, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountMajor || 0)

function resolveDate(createdAt: OrderDoc['createdAt']) {
  if (typeof createdAt === 'string') return new Date(createdAt)
  if (createdAt instanceof Timestamp) return createdAt.toDate()
  if (createdAt instanceof Date) return createdAt
  if (createdAt && typeof createdAt === 'object') {
    const seconds =
      typeof (createdAt as { seconds?: number }).seconds === 'number'
        ? (createdAt as { seconds?: number }).seconds
        : typeof (createdAt as { _seconds?: number })._seconds === 'number'
        ? (createdAt as { _seconds?: number })._seconds
        : undefined
    const nanos =
      typeof (createdAt as { nanoseconds?: number }).nanoseconds === 'number'
        ? (createdAt as { nanoseconds?: number }).nanoseconds
        : typeof (createdAt as { _nanoseconds?: number })._nanoseconds === 'number'
        ? (createdAt as { _nanoseconds?: number })._nanoseconds
        : 0
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000 + Math.floor((nanos ?? 0) / 1e6))
    }
  }
  return null
}

export default function OrdersPage() {
  const { t } = useI18n()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderDoc[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setOrders([])
      setLoading(false)
      return
    }

    const fetchOrders = async () => {
      try {
        setLoading(true)
        const token = await user.getIdToken()
        const res = await fetch('/api/user/orders', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error('Failed to fetch orders')
        const data = (await res.json()) as OrderDoc[]
        setOrders(data)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [user, authLoading])

  if (!user && !authLoading) {
    return (
      <div className="min-h-[60vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-zinc-200 bg-white/90 px-6 py-10 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-[#0d141c]">{t('orders.title')}</h1>
          <p className="mt-2 text-sm text-zinc-600">{t('orders.loginPrompt')}</p>
          <Link
            href="/user/login"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0d141c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2a37]"
          >
            {t('nav.login')}
          </Link>
        </div>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-[40vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto grid w-full max-w-5xl gap-6">
          <div className="h-40 rounded-3xl border border-zinc-200 bg-white/80 shadow animate-pulse" />
          <div className="h-52 rounded-3xl border border-zinc-200 bg-white/75 shadow animate-pulse" />
        </div>
      </div>
    )
  }

  if (!orders.length) {
    return (
      <div className="bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-8 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-[#0d141c]">{t('orders.title')}</h1>
            <p className="mt-2 text-sm text-zinc-600">{t('orders.empty')}</p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-zinc-200 px-5 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-white"
            >
              {t('fav.continue')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const totalSpent = orders.reduce((sum, o) => {
    const amount = typeof o.amountTotal === 'number' ? o.amountTotal : Number(o.amountTotal ?? 0)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)

  return (
    <div className="bg-[#f6f7fb] px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)] md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#0d141c]">{t('orders.title')}</h1>
              <p className="text-sm text-zinc-600">Review your recent purchases and access receipts instantly.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f4f4f5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
                {orders.length} orders
              </span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-[#0d141c]">
                Total {fmtMajor(totalSpent, orders[0]?.currency?.toUpperCase() || 'USD')}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {orders.map((o) => {
            const date = resolveDate(o.createdAt)
            const when = date ? date.toLocaleString(undefined) : ''
            const count =
              o.items?.reduce((n, it) => {
                const qty = Number(it.quantity ?? 0)
                return n + (Number.isFinite(qty) ? qty : 0)
              }, 0) ?? 0
            const totalMajor = (() => {
              if (typeof o.amountTotal === 'number') return o.amountTotal
              const parsed = Number(o.amountTotal ?? 0)
              return Number.isFinite(parsed) ? parsed : 0
            })()
            const currency = (o.currency ?? 'USD').toUpperCase()
            const status = String(o.status || 'paid').toLowerCase()

            return (
              <div key={o.id} className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_16px_32px_rgba(15,23,42,0.06)] md:px-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Order</div>
                    <div className="text-lg font-semibold text-[#0d141c]">#{o.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Total</div>
                    <div className="text-lg font-semibold text-[#0d141c]">{fmtMajor(totalMajor, currency)}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  {when && (
                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f4f4f5] px-3 py-1 font-semibold text-zinc-600">
                      📅 {when}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f4f4f5] px-3 py-1 font-semibold text-zinc-600">
                    📦 {count} items
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${
                      status === 'canceled'
                        ? 'border border-rose-200 bg-rose-50 text-rose-700'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {status.toUpperCase()}
                  </span>
                  {o.paymentStatus && (
                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 font-semibold text-zinc-600">
                      💳 {String(o.paymentStatus).toUpperCase()}
                    </span>
                  )}
                </div>

                {o.items && o.items.length > 0 && (
                  <ul className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-[#f6f7fb]">
                    {(o.items ?? []).map((it, i) => (
                      <li key={i} className="flex items-center justify-between px-4 py-3 text-sm text-[#0d141c]">
                        <span className="max-w-[70%] truncate">
                          {it.description || it.title || it.priceId || 'Product'}
                        </span>
                        <span className="text-zinc-600">× {Number(it.quantity ?? 0) || 0}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                  <span>Session: {o.sessionId || 'N/A'}</span>
                  <Link
                    prefetch={false}
                    href={`/user/orders/${o.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      router.push(`/user/orders/${o.id}`)
                    }}
                    className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-[#0d141c] transition hover:bg-white"
                  >
                    View details
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center rounded-full bg-[#0d141c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2a37]"
          >
            {t('fav.continue')}
          </Link>
        </div>
      </div>
    </div>
  )
}
