'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useState } from 'react'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export default function CartPage() {
  const { state, total, incr, decr, remove, clear } = useCart()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: state.items.map((it) => ({
            productId: String(it.productId),
            title: it.title,
            price: Number(it.price) || 0,
            quantity: it.qty,
          })),
          userId: user?.uid ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = (data && data.error) || 'Checkout failed'
        toast.error(msg)
        setLoading(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('No checkout URL returned')
        setLoading(false)
        return
      }
    } catch (error) {
      toast.error('Checkout error')
      console.error('Checkout error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (state.items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-semibold mb-2">Your cart is empty</h1>
        <p className="text-zinc-500">
          Start adding some products to your cart.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-black px-4 py-2 text-white"
        >
          Continue shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Shopping Cart</h1>
        <button
          type="button"
          onClick={clear}
          className="text-sm text-red-600 hover:underline"
        >
          Clear cart
        </button>
      </div>

      <div className="grid md:grid-cols-[2fr_1fr] gap-6">
        {/* Items */}
        <div className="space-y-4">
          {state.items.map((it) => {
            const line = (Number(it.price) || 0) * it.qty
            return (
              <div
                key={`${it.productId}`}
                className="flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="flex items-center gap-3">
                  {it.thumbnail ? (
                    <div className="relative w-14 h-14 rounded overflow-hidden bg-slate-100">
                      <Image
                        src={it.thumbnail}
                        alt={it.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded bg-slate-100" />
                  )}
                  <div>
                    <div className="font-medium">{it.title}</div>
                    <div className="text-sm text-zinc-500">
                      {currency.format(Number(it.price) || 0)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center rounded-xl border">
                    <button
                      type="button"
                      className="px-3 py-1"
                      onClick={() => decr(it.productId)}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="px-3 py-1 min-w-8 text-center">
                      {it.qty}
                    </span>
                    <button
                      type="button"
                      className="px-3 py-1"
                      onClick={() => incr(it.productId)}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex w-24 justify-end font-medium">
                    {currency.format(line)}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(it.productId)}
                    className="text-sm text-zinc-500 hover:text-red-600"
                    aria-label="Remove item"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="rounded-xl border p-4 h-fit">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-zinc-600">Subtotal</div>
            <div className="font-medium">{currency.format(total)}</div>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Shipping and taxes calculated at checkout.
          </p>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-2 text-white hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Checkout
          </button>

          <Link
            href="/"
            className="mt-3 block text-center text-sm text-zinc-600 hover:underline"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
