'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { useCart } from '@/context/CartContext'

type SummaryItem = { name: string; qty: number }

const fmt = (n: number, c = 'USD') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: c }).format(n)

export default function SuccessPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const sessionId = useMemo(() => sp.get('id') ?? '', [sp])

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
    if (!sessionId) {
      router.replace('/')
      return
    }
    if (authLoading) return
    if (ran.current || inFlight.current) return
    ran.current = true
    inFlight.current = true

    let cancelled = false
    const ac = new AbortController()

    async function run() {
      try {
        // Fetch Stripe session details for UI
        const res = await fetch(
          `/api/admin/session/${encodeURIComponent(sessionId)}`,
          { cache: 'no-store', signal: ac.signal }
        )
        if (res.ok) {
          const data = await res.json()
          const s = data?.session as {
            amount_total?: number | null
            currency?: string | null
            payment_status?: string | null
            line_items?: { data: Array<{ description?: string; quantity?: number }> }
          }
          const isPaid = (s?.payment_status ?? 'paid') === 'paid'

          const li = (s?.line_items?.data ?? []).map((row) => ({
            name: row?.description || 'Product',
            qty: row?.quantity ?? 1,
          }))

          if (!cancelled) {
            setItems(li)
            setTotal(typeof s?.amount_total === 'number' ? s.amount_total : null)
            setCurrency((s?.currency ?? 'usd').toUpperCase())
          }

          if (isPaid) {
            // Clear cart once
            try { clear() } catch {}
            try { reloadFromStorage() } catch {}
          }
        }

        // Ensure order is written (fallback if webhook didn't run)
        if (!cancelled && user) {
          try {
            const ref = collection(db, 'users', user.uid, 'orders')
            const q = query(ref, where('sessionId', '==', sessionId), limit(1))
            const snap = await getDocs(q)
            if (!cancelled && !snap.empty) {
              setOrderDocId(snap.docs[0].id)
            } else {
              const token = await user.getIdToken()
              const ensureRes = await fetch('/api/user/orders/ensure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id: sessionId }),
              })
              if (ensureRes.ok) {
                // Try query again
                const snap2 = await getDocs(q)
                if (!cancelled && !snap2.empty) setOrderDocId(snap2.docs[0].id)
              }
            }
          } catch {}
        }
      } finally {
        inFlight.current = false
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => { cancelled = true; ac.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, authLoading, user])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4 animate-pulse" />
        <div className="h-4 w-80 bg-gray-100 rounded mb-6 animate-pulse" />
        <div className="h-40 w-full bg-gray-50 rounded animate-pulse" />
      </div>
    )
  }

  const orderId = sessionId
  const eta = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  })()
  const payMethod = 'Kredi Kartı'

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          ✓
        </div>
        <h1 className="text-2xl font-semibold">Siparişiniz Onaylandı!</h1>
        <p className="mt-1 text-sm text-zinc-600">Sipariş detaylarını aşağıda bulabilirsiniz.</p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-white shadow-sm">
        {/* Details table */}
        <div className="grid grid-cols-1 gap-0 divide-y sm:grid-cols-3 sm:divide-y-0">
          <div className="p-4 sm:col-span-1 bg-zinc-50 rounded-t-2xl sm:rounded-tr-none sm:rounded-l-2xl">
            <div className="text-sm font-medium text-zinc-700">Sipariş Numarası</div>
            <div className="mt-1 text-sm text-zinc-900">#{orderId}</div>
          </div>
          <div className="p-4 sm:col-span-1 bg-zinc-50">
            <div className="text-sm font-medium text-zinc-700">Tahmini Teslimat Tarihi</div>
            <div className="mt-1 text-sm text-zinc-900">{eta}</div>
          </div>
          <div className="p-4 sm:col-span-1 bg-zinc-50 rounded-b-2xl sm:rounded-bl-none sm:rounded-r-2xl">
            <div className="text-sm font-medium text-zinc-700">Ödeme Yöntemi</div>
            <div className="mt-1 text-sm text-zinc-900">{payMethod}</div>
          </div>
        </div>

        {/* Items */}
        <div className="p-6">
          <h2 className="text-sm font-medium text-zinc-700 mb-3">Sipariş Kalemleri</h2>
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
            <p className="text-sm text-zinc-500">Kalem bulunamadı.</p>
          )}

          {/* Total */}
          {total != null && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-zinc-600">Toplam Tutar</span>
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
            Sipariş Detaylarını Görüntüle
          </Link>
          <Link
            href="/user/profile"
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Profilime Git
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Alışverişe Devam Et
          </Link>
        </div>
      </div>
    </div>
  )
}
