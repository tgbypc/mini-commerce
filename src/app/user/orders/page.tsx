'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

type OrderItem = {
  description?: string
  quantity: number
  amountSubtotal?: number // cents
  amountTotal?: number // cents
  priceId?: string | null
}
type OrderDoc = {
  id: string
  sessionId?: string
  amountTotal?: number | null // major currency (webhook'ta /100 yapılmıştı)
  currency?: string | null // 'try' | 'usd'...
  paymentStatus?: string | null
  createdAt?: Timestamp | Date | null
  items?: OrderItem[]
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function pickNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}
function pickTimestamp(v: unknown): Timestamp | Date | undefined {
  return v instanceof Timestamp || v instanceof Date ? v : undefined
}
function pickItems(v: unknown): OrderItem[] {
  if (!Array.isArray(v)) return []
  return v.map((it): OrderItem => {
    const obj =
      typeof it === 'object' && it !== null
        ? (it as Record<string, unknown>)
        : {}
    return {
      description: pickString(obj.description),
      quantity: pickNumber(obj.quantity) ?? 0,
      amountSubtotal: pickNumber(obj.amountSubtotal),
      amountTotal: pickNumber(obj.amountTotal),
      priceId: pickString(obj.priceId) ?? null,
    }
  })
}

const fmtMajor = (amountMajor = 0, currency = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(
    amountMajor || 0
  )

export default function OrdersPage() {
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
        <h1 className="text-2xl font-semibold">Siparişlerim</h1>
        <p className="mt-2 text-zinc-600">
          Lütfen siparişlerinizi görmek için giriş yapın.
        </p>
        <Link
          href="/user/login"
          className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Giriş Yap
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
        <h1 className="text-2xl font-semibold">Siparişlerim</h1>
        <p className="mt-2 text-zinc-600">Henüz bir siparişiniz yok.</p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Alışverişe Devam Et
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Siparişlerim</h1>

      {orders.map((o) => {
        const date =
          o.createdAt instanceof Timestamp
            ? o.createdAt.toDate()
            : o.createdAt instanceof Date
            ? o.createdAt
            : null
        const when = date ? date.toLocaleString('tr-TR') : ''
        const count = o.items?.reduce((n, it) => n + (it.quantity ?? 0), 0) ?? 0
        const currency = (o.currency ?? 'TRY').toUpperCase()

        return (
          <div key={o.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-600">Sipariş No</div>
                <div className="text-base font-semibold">#{o.id}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-600">Tutar</div>
                <div className="text-base font-semibold">
                  {fmtMajor(o.amountTotal ?? 0, currency)}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Tarih</div>
                <div className="text-sm">{when}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Kalem Sayısı</div>
                <div className="text-sm">{count}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Ödeme</div>
                <div className="text-sm">Kredi Kartı</div>
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
                      {it.description ?? it.priceId ?? 'Ürün'}
                    </span>
                    <span className="text-zinc-600">× {it.quantity}</span>
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
                Detayı Gör
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
          Alışverişe Devam Et
        </Link>
      </div>
    </div>
  )
}
