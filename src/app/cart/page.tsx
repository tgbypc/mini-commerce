'use client'

import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

export default function CartPage() {
  const { state, total, incr, decr, remove } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const checkout = async () => {
    try {
      if (!user) {
        toast.error('Please sign in to complete checkout')
        router.push('/user/login?next=/cart')
        return
      }
      setLoading(true)
      type CheckoutBody = { items: { productId: string; quantity: number }[]; uid?: string; email?: string }
      const payload: CheckoutBody = {
        items: state.items.map((i) => ({ productId: i.productId, quantity: i.qty })),
      }
      if (user?.uid) payload.uid = user.uid
      if (user?.email) payload.email = user.email

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Checkout failed')
        return
      }
      if (data?.url) {
        window.location.href = data.url
      } else {
        toast.error('No checkout URL')
      }
    } catch (e) {
      console.error(e)
      toast.error('Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  if (state.items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-xl border p-6 text-sm text-zinc-600">
          Your cart is empty.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Cart</h1>

      <div className="space-y-3 rounded-xl border p-4">
        {state.items.map((it) => (
          <div key={it.productId} className="flex items-center justify-between">
            <div className="text-sm">
              {it.title} — ${it.price.toFixed(2)}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded border px-2 py-1"
                onClick={() => decr(it.productId)}
              >
                -
              </button>
              <div className="w-8 text-center">{it.qty}</div>
              <button
                className="rounded border px-2 py-1"
                onClick={() => incr(it.productId)}
              >
                +
              </button>
              <button
                className="rounded border px-2 py-1"
                onClick={() => remove(it.productId)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border p-4">
        <div className="text-sm text-zinc-600">Total</div>
        <div className="text-base font-semibold">${total.toFixed(2)}</div>
      </div>

      <div className="flex gap-3">
        <Link href="/" className="rounded-xl border px-4 py-2">
          Continue shopping
        </Link>
        <button
          onClick={checkout}
          disabled={loading}
          className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-60"
        >
          {loading ? 'Redirecting...' : 'Checkout'}
        </button>
      </div>
    </div>
  )
}
