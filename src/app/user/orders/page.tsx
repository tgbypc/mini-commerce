'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import EmptyState from '@/components/ui/EmptyState'
import { useRouter } from 'next/navigation'

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
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
    amountMajor || 0
  )

export default function OrdersPage() {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderDoc[]>([])

  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

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
        const res = await fetch('/api/user/orders', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          throw new Error('Failed to fetch orders')
        }

        const data = await res.json()
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
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">{t('orders.title')}</h1>
        <p className="mt-2 text-zinc-600">{t('orders.loginPrompt')}</p>
        <Link
          href="/user/login"
          className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          {t('nav.login')}
        </Link>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="h-6 w-40 bg-gray-200 rounded mb-3 animate-pulse" />
        <div className="h-4 w-64 bg-gray-100 rounded mb-4 animate-pulse" />
        <div className="h-24 w-full bg-gray-50 rounded animate-pulse" />
      </div>
    )
  }

  if (!orders.length) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">{t('orders.title')}</h1>
        <EmptyState
          message={t('orders.empty')}
          action={
            <Link
              href="/"
              className="inline-flex rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              {t('fav.continue')}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">My Orders</h1>

      {orders.map((o) => {
        const createdAt = o.createdAt
        const date =
          typeof createdAt === 'string'
            ? new Date(createdAt)
            : createdAt instanceof Timestamp
            ? createdAt.toDate()
            : createdAt instanceof Date
            ? createdAt
            : (() => {
                if (createdAt && typeof createdAt === 'object') {
                  const seconds =
                    typeof (createdAt as { seconds?: number }).seconds ===
                    'number'
                      ? (createdAt as { seconds?: number }).seconds
                      : typeof (createdAt as { _seconds?: number })._seconds ===
                        'number'
                      ? (createdAt as { _seconds?: number })._seconds
                      : undefined
                  const nanos =
                    typeof (createdAt as { nanoseconds?: number })
                      .nanoseconds === 'number'
                      ? (createdAt as { nanoseconds?: number }).nanoseconds
                      : typeof (createdAt as { _nanoseconds?: number })
                          ._nanoseconds === 'number'
                      ? (createdAt as { _nanoseconds?: number })._nanoseconds
                      : 0
                  if (typeof seconds === 'number') {
                    const ms = seconds * 1000 + Math.floor((nanos ?? 0) / 1e6)
                    return new Date(ms)
                  }
                }
                return null
              })()
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

        return (
          <div key={o.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-600">Order No.</div>
                <div className="text-base font-semibold">#{o.id}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-600">Amount</div>
                <div className="text-base font-semibold">
                  {fmtMajor(totalMajor, currency)}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Date</div>
                <div className="text-sm">{when}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Item Count</div>
                <div className="text-sm">{count}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Status</div>
                <div className="text-sm">
                  {(o.status || 'paid').toUpperCase()}
                </div>
              </div>
            </div>

            {o.items && o.items.length > 0 && (
              <ul className="mt-3 divide-y rounded-xl border bg-zinc-50">
                {(o.items ?? []).map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between p-3 text-sm"
                  >
                    <span className="text-zinc-900">
                      {it.description || it.title || it.priceId || 'Product'}
                    </span>
                    <span className="text-zinc-600">
                      × {Number(it.quantity ?? 0) || 0}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-end">
              <Link
                prefetch={false}
                href={`/user/orders/${o.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  const href = `/user/orders/${o.id}`
                  console.log('[orders] navigating to', href)
                  router.push(href)
                }}
                className="inline-flex rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
              >
                View Details
              </Link>
            </div>
          </div>
        )
      })}

      <div className="pt-2">
        <Link
          href="/"
          className="inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}
