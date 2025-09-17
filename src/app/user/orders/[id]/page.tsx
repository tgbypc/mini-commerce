'use client'

import { useEffect, useMemo, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { useParams } from 'next/navigation'

type LineItem = {
  productId: string | null
  description?: string
  quantity: number
  unitAmount: number | null
  currency: string
  thumbnail?: string | null
}

type OrderDetail = {
  id: string
  sessionId?: string
  amountTotal?: number | null
  currency?: string | null
  paymentStatus?: string | null
  createdAt?: Timestamp | Date | null
  items?: LineItem[]
}

const fmt = (n: number | null | undefined, c = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: c }).format(
    typeof n === 'number' ? n : 0
  )

export default function OrderDetailPage() {
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const { user, loading: authLoading } = useAuth()
  const params = useParams()
  const orderId = params.id as string

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
        if (res.ok) {
          const data = (await res.json()) as OrderDetail
          if (!cancelled) setOrder(data)
        }
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

  if (loading || authLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="h-6 w-48 bg-gray-200 rounded mb-3 animate-pulse" />
        <div className="h-4 w-72 bg-gray-100 rounded mb-4 animate-pulse" />
        <div className="h-24 w-full bg-gray-50 rounded animate-pulse" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Sipariş</h1>
        <p className="mt-2 text-zinc-600">Sipariş bulunamadı.</p>
      </div>
    )
  }

  const date =
    order.createdAt instanceof Timestamp
      ? order.createdAt.toDate()
      : order.createdAt instanceof Date
      ? order.createdAt
      : null
  const when = date ? date.toLocaleString('tr-TR') : ''
  const currency = (order.currency ?? 'TRY').toUpperCase()

  const steps = [
    { key: 'paid', label: 'Ödeme Onaylandı' },
    { key: 'preparing', label: 'Hazırlanıyor' },
    { key: 'shipped', label: 'Kargoya Verildi' },
  ]
  const activeIdx = 0 // Basic: payment confirmed only; extend with shipping later

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sipariş #{order.id}</h1>
          <div className="text-sm text-zinc-600 mt-1">{when}</div>
        </div>
        <div>
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            {order.paymentStatus === 'paid' ? 'Ödeme Onaylandı' : (order.paymentStatus || 'Beklemede')}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`size-2 rounded-full ${i <= activeIdx ? 'bg-black' : 'bg-zinc-300'}`} />
            <div className={`text-xs ${i <= activeIdx ? 'text-zinc-900' : 'text-zinc-500'}`}>{s.label}</div>
            {i < steps.length - 1 && <div className="w-6 h-px bg-zinc-300" />}
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Kalemler</h2>
        {order.items && order.items.length ? (
          <ul className="divide-y">
            {order.items.map((it, idx) => (
              <li key={idx} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  {it.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.thumbnail} alt={it.description || 'Ürün'} className="size-12 rounded-md object-cover" />
                  ) : (
                    <div className="size-12 rounded-md bg-zinc-100" />)
                  }
                  <div>
                    <div className="text-sm font-medium">{it.description || 'Ürün'}</div>
                    <div className="text-xs text-zinc-600">× {it.quantity}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold min-w-24 text-right">
                  {fmt((it.unitAmount ?? 0) * (it.quantity ?? 0), currency)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600">Kalem bulunamadı.</p>
        )}
        <div className="mt-4 flex items-center justify-end gap-6 text-sm">
          <div className="text-zinc-600">Toplam</div>
          <div className="font-semibold">{fmt(order.amountTotal ?? 0, currency)}</div>
        </div>
      </div>
    </div>
  )
}
