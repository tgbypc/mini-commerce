'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

type OrderItem = {
  title: string
  quantity: number
  unitAmount: number | null
  currency: string | null
}

type OrderDoc = {
  orderId: string
  amountTotal: number
  currency: string
  createdAt?: { seconds: number; nanoseconds: number }
  items: OrderItem[]
}

function fmt(n: number, c = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: c,
  }).format(n)
}

export default function UserOrdersPage() {
  const { user, loading } = useAuth()
  const [orders, setOrders] = useState<OrderDoc[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading) {
      // Auth is still resolving; don't show orders spinner yet.
      setBusy(false)
      return
    }
    if (!user) {
      // Not logged in; ensure we're not stuck in loading.
      setBusy(false)
      return
    }

    ;(async () => {
      setBusy(true)
      try {
        const q = query(
          collection(db, 'users', user.uid, 'orders'),
          orderBy('createdAt', 'desc')
        )
        const snap = await getDocs(q)
        const rows = snap.docs.map((d) => {
          const data = d.data() as Partial<OrderDoc>
          return {
            orderId: data.orderId ?? d.id,
            amountTotal: Number(data.amountTotal ?? 0),
            currency: String(data.currency ?? 'USD').toUpperCase(),
            createdAt: data.createdAt,
            items: Array.isArray(data.items) ? (data.items as OrderItem[]) : [],
          }
        })
        setOrders(rows)
      } catch (e) {
        console.error('[orders] fetch error:', e)
        setOrders([])
      } finally {
        setBusy(false)
      }
    })()
  }, [user, loading])

  if (loading) {
    return <div className="max-w-3xl mx-auto p-6">Checking your session…</div>
  }
  if (busy) {
    return <div className="max-w-3xl mx-auto p-6">Loading orders…</div>
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Please sign in</h1>
        <p className="text-zinc-600">
          You need to be logged in to view your orders.
        </p>
        <Link
          href="/"
          className="inline-block mt-3 rounded-xl border px-4 py-2"
        >
          Go home
        </Link>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Your orders</h1>
        <p className="text-zinc-600">No orders yet.</p>
        <Link
          href="/"
          className="inline-block mt-3 rounded-xl border px-4 py-2"
        >
          Continue shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Your orders</h1>
      {orders.map((o) => (
        <div key={o.orderId} className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-zinc-600">
              Order #{o.orderId.slice(0, 8)}
            </div>
            <div className="font-medium">{fmt(o.amountTotal, o.currency)}</div>
          </div>
          <div className="space-y-1 text-sm">
            {o.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  {it.title}{' '}
                  <span className="text-zinc-500">× {it.quantity}</span>
                </div>
                <div>
                  {it.unitAmount != null
                    ? fmt(
                        (it.unitAmount / 100) * it.quantity,
                        (it.currency ?? o.currency).toUpperCase()
                      )
                    : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
