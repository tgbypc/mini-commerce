'use client'

import { useEffect, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { fmtCurrency } from '@/lib/money'
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

const fmt = (n: number | null | undefined, c = 'USD') => fmtCurrency(n ?? 0, c)

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
        <h1 className="text-2xl font-semibold">Order</h1>
        <p className="mt-2 text-zinc-600">Order not found.</p>
      </div>
    )
  }

  const date =
    order.createdAt instanceof Timestamp
      ? order.createdAt.toDate()
      : order.createdAt instanceof Date
      ? order.createdAt
      : null
  const when = date ? date.toLocaleString(undefined) : ''
  const currency = (order.currency ?? 'USD').toUpperCase()

  const steps: { key: NonNullable<OrderDetail['status']>; label: string }[] = [
    { key: 'paid', label: 'Payment Confirmed' },
    { key: 'fulfilled', label: 'Processing' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered', label: 'Delivered' },
  ]
  const activeIdx = Math.max(0, steps.findIndex((s) => s.key === (order.status || 'paid')))

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Order #{order.id}</h1>
          <div className="text-sm text-zinc-600 mt-1">{when}</div>
        </div>
        <div>
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            {order.paymentStatus === 'paid' ? 'Payment Confirmed' : (order.paymentStatus || 'Pending')}
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
        <h2 className="text-lg font-semibold mb-3">Items</h2>
        {order.items && order.items.length ? (
          <ul className="divide-y">
            {order.items.map((it, idx) => (
              <li key={idx} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  {it.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.thumbnail} alt={it.description || 'Product'} className="size-12 rounded-md object-cover" />
                  ) : (
                    <div className="size-12 rounded-md bg-zinc-100" />)
                  }
                  <div>
                    <div className="text-sm font-medium">{it.description || 'Product'}</div>
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
          <p className="text-sm text-zinc-600">No items found.</p>
        )}
        {(() => {
          const subtotal = (order.items || []).reduce((s, it) => s + ((it.unitAmount || 0) * (it.quantity || 0)), 0)
          const shipping = order.shipping?.amountTotal || 0
          return (
            <div className="mt-4 flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center justify-end gap-6">
                <div className="text-zinc-600">Subtotal</div>
                <div className="font-medium">{fmt(subtotal, currency)}</div>
              </div>
              <div className="flex items-center justify-end gap-6">
                <div className="text-zinc-600">Shipping{order.shipping?.method ? ` (${order.shipping.method})` : ''}</div>
                <div className="font-medium">{fmt(shipping, currency)}</div>
              </div>
              <div className="flex items-center justify-end gap-6">
                <div className="text-zinc-600">Total</div>
                <div className="font-semibold">{fmt((order.amountTotal || 0), currency)}</div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Shipping address */}
      {order.shipping?.address && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Shipping Address</h2>
          {(() => {
            const address = order.shipping?.address
            if (!address) return null
            const firstLine = [address.line1, address.line2].filter(Boolean).join(' ')
            const secondLine = [address.postal_code, address.city || address.town, address.state]
              .filter(Boolean)
              .join(' ')
            return (
              <div className="text-sm text-zinc-700">
                {order.shipping?.name && <div>{order.shipping.name}</div>}
                <div>{firstLine}</div>
                <div>{secondLine}</div>
                <div>{address.country ?? ''}</div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
