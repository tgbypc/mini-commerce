'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext' // kendi yoluna uyarlayın
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'

const fmt = (n: number, c = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n)

type SummaryItem = { name: string; qty: number }

type StripeLineItem = {
  description?: string | null
  quantity?: number | null
  price?: {
    unit_amount?: number | null
    currency?: string | null
    product?: { name?: string | null } | string | null
  } | null
}

type StripeSession = {
  id: string
  amount_total?: number | null
  currency?: string | null
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required' | string
  status?: string
  payment_intent?: { status?: string }
  line_items?: { data: StripeLineItem[] }
}

export default function SuccessClient() {
  const sp = useSearchParams()
  const router = useRouter()
  const id = useMemo(() => sp.get('session_id') ?? '', [sp])

  const { clear, reloadFromStorage } = useCart()
  const { user, loading: authLoading } = useAuth()
  const [orderDocId, setOrderDocId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<SummaryItem[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)

  const ran = useRef(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!id) {
      router.replace('/')
      return
    }
    if (authLoading) return
    if (ran.current) return
    ran.current = true
    if (inFlight.current) return
    inFlight.current = true

    let cancelled = false
    const ac = new AbortController()

    async function run() {
      try {
        const res = await fetch(
          `/api/admin/session/${encodeURIComponent(id)}`,
          {
            cache: 'no-store',
            signal: ac.signal,
          }
        )
        if (!res.ok) throw new Error('Session fetch failed')

        const data = await res.json()
        const s: StripeSession | undefined = data?.session

        const isPaid =
          s?.payment_status === 'paid' ||
          s?.status === 'complete' ||
          s?.payment_intent?.status === 'succeeded'

        const li = (s?.line_items?.data ?? []).map((row: StripeLineItem) => ({
          name:
            row?.description ??
            (typeof row?.price?.product === 'object'
              ? row?.price?.product?.name
              : undefined) ??
            'Product',
          qty: row?.quantity ?? 1,
        }))

        if (!cancelled) {
          setItems(li)
          setTotal(typeof s?.amount_total === 'number' ? s.amount_total : null)
          setCurrency((s?.currency ?? 'usd').toUpperCase())
        }

        if (isPaid) {
          // clear cart definitively
          clear()
          try {
            localStorage.removeItem('mini-cart-v1')
            localStorage.removeItem('mc_cart')
          } catch {}
          try {
            reloadFromStorage()
          } catch {}
        }

        // Try to resolve the user's order document by sessionId
        if (!cancelled && isPaid && user) {
          try {
            const ref = collection(db, 'users', user.uid, 'orders')
            const q = query(ref, where('sessionId', '==', id), limit(1))
            const snap = await getDocs(q)
            if (!cancelled && !snap.empty) {
              const docId = snap.docs[0].id
              setOrderDocId(docId)
            }
          } catch {
            // ignore — link will fall back to /user/orders
          }
        }
      } catch {
        // no-op; consider toast
      } finally {
        inFlight.current = false
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
      ac.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authLoading, user])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4 animate-pulse" />
        <div className="h-4 w-80 bg-gray-100 rounded mb-6 animate-pulse" />
        <div className="h-40 w-full bg-gray-50 rounded animate-pulse" />
      </div>
    )
  }

  // UI helpers
  const orderId = id
  const eta = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  })()
  const payMethod = 'Credit Card'

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          ✓
        </div>
        <h1 className="text-2xl font-semibold">Order Confirmed!</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Your order was received successfully. You can review the details
          below.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-white shadow-sm">
        {/* Details table */}
        <div className="grid grid-cols-1 gap-0 divide-y sm:grid-cols-3 sm:divide-y-0">
          <div className="p-4 sm:col-span-1 bg-zinc-50 rounded-t-2xl sm:rounded-tr-none sm:rounded-l-2xl">
            <div className="text-sm font-medium text-zinc-700">Order Number</div>
            <div className="mt-1 text-sm text-zinc-900">#{orderId}</div>
          </div>
          <div className="p-4 sm:col-span-1 bg-zinc-50">
            <div className="text-sm font-medium text-zinc-700">Estimated Delivery Date</div>
            <div className="mt-1 text-sm text-zinc-900">{eta}</div>
          </div>
          <div className="p-4 sm:col-span-1 bg-zinc-50 rounded-b-2xl sm:rounded-bl-none sm:rounded-r-2xl">
            <div className="text-sm font-medium text-zinc-700">Payment Method</div>
            <div className="mt-1 text-sm text-zinc-900">{payMethod}</div>
          </div>
        </div>

        {/* Items */}
        <div className="p-6">
          <h2 className="text-sm font-medium text-zinc-700 mb-3">Order Items</h2>
          {items.length ? (
            <ul className="divide-y rounded-xl border bg-zinc-50">
              {items.map((it, i) => (
                <li key={i} className="flex items-center justify-between p-3">
                  <span className="text-sm text-zinc-900">{it.name}</span>
                  <span className="text-sm text-zinc-600">× {it.qty}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No items found.</p>
          )}

          {/* Total */}
          {total != null && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-zinc-600">Total Amount</span>
              <span className="text-base font-semibold">
                {fmt(total / 100, currency ?? 'USD')}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:justify-end">
          <Link
            href={orderDocId ? `/user/orders/${orderDocId}` : '/user/orders'}
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            View Order Details
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
