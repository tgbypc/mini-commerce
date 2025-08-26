'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type OrderItem = { productId: string; quantity: number }
type OrderDoc = {
  id: string
  total?: number | null // cents
  currency?: string | null // 'try' | 'usd'...
  createdAt?: Timestamp | Date | null
  items?: OrderItem[]
}

const fmt = (amountCents = 0, currency = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(
    (amountCents || 0) / 100
  )

export default function OrdersPage() {
  const [uid, setUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderDoc[]>([])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!uid) {
      setOrders([])
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDocs(collection(db, 'users', uid, 'orders'))
        const list: OrderDoc[] = []
        snap.forEach((d) => {
          const data = d.data() as Partial<OrderDoc> & Record<string, unknown>
          list.push({
            id: d.id,
            total: data?.total ?? null,
            currency: (data?.currency ?? 'try') as string,
            createdAt:
              data?.createdAt instanceof Timestamp ||
              data?.createdAt instanceof Date
                ? (data.createdAt as Timestamp | Date)
                : null,
            items: (data?.items ?? []) as OrderItem[],
          })
        })
        // newest first
        list.sort((a, b) => {
          const ad =
            a.createdAt && 'toDate' in a.createdAt
              ? a.createdAt.toDate()
              : (a.createdAt as Date | null)
          const bd =
            b.createdAt && 'toDate' in b.createdAt
              ? b.createdAt.toDate()
              : (b.createdAt as Date | null)
          return (bd?.getTime?.() ?? 0) - (ad?.getTime?.() ?? 0)
        })
        if (!cancelled) setOrders(list)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uid])

  if (uid === null) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Siparişlerim</h1>
        <p className="mt-2 text-zinc-600">
          Lütfen siparişlerinizi görmek için giriş yapın.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Giriş Yap
        </Link>
      </div>
    )
  }

  if (loading) {
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
                  {fmt(o.total ?? 0, currency)}
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
                    <span className="text-zinc-900">{it.productId}</span>
                    <span className="text-zinc-600">× {it.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
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
