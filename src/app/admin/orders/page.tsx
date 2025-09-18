'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

type OrderItem = {
  productId?: string | null
  title?: string | null
  quantity?: number | null
  unitAmount?: number | null
  currency?: string | null
}

type Order = {
  id: string
  userId?: string | null
  email?: string | null
  amountTotal?: number | null
  currency?: string | null
  paymentStatus?: string | null
  status?: 'paid' | 'fulfilled' | 'shipped' | 'delivered' | 'canceled'
  createdAt?: unknown
  updatedAt?: unknown
  trackingNumber?: string | null
  carrier?: string | null
  notes?: string | null
  items?: OrderItem[]
}

const STATUSES: NonNullable<Order['status']>[] = ['paid', 'fulfilled', 'shipped', 'delivered', 'canceled']

function isStatus(value: string): value is NonNullable<Order['status']> {
  return STATUSES.includes(value as NonNullable<Order['status']>)
}

export default function AdminOrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<Order['status'] | ''>('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const token = await user?.getIdToken().catch(() => undefined)
        const url = new URL('/api/admin/orders', location.origin)
        if (statusFilter) url.searchParams.set('status', statusFilter)
        const res = await fetch(url.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        const data = await res.json()
        if (!alive) return
        setOrders(Array.isArray(data.items) ? data.items : [])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [user, statusFilter])

  async function updateStatus(id: string, status: Order['status']) {
    if (!user) return
    setSaving(id)
    try {
      const token = await user.getIdToken().catch(() => undefined)
      const res = await fetch('/api/admin/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error('Update failed')
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
    } catch (e) {
      alert((e as Error).message || 'Update failed')
    } finally {
      setSaving(null)
    }
  }

  const list = useMemo(() => orders, [orders])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Orders</h2>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter || ''}
            onChange={(e) => {
              const { value } = e.target
              setStatusFilter(value === '' ? '' : isStatus(value) ? value : '')
            }}
            className="rounded-lg border px-3 py-2 text-sm bg-white"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border p-4 text-sm text-zinc-600">Loading…</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border p-4 text-sm text-zinc-600">No orders.</div>
      ) : (
        <div className="space-y-2">
          {list.map((o) => (
            <div key={o.id} className="rounded-xl border bg-white p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">#{o.id}</div>
                <div className="text-xs text-zinc-600 truncate">{o.email || o.userId || '-'}</div>
              </div>
              <div className="text-sm">{typeof o.amountTotal === 'number' ? `$${o.amountTotal.toFixed(2)}` : '-'}</div>
              <div>
                <select
                  value={o.status || 'paid'}
                  onChange={(e) => updateStatus(o.id, e.target.value as Order['status'])}
                  disabled={saving === o.id}
                  className="rounded-lg border px-2 py-1 text-sm bg-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
