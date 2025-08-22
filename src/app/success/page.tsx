'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { toast } from 'react-hot-toast'
import Stripe from 'stripe'

type Line = { title: string; qty: number; amount: number; currency: string }
const fmt = (n: number, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)

type StripeSession = Stripe.Checkout.Session & {
  line_items?: { data: Stripe.LineItem[] }
}

export default function SuccessPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const { clear } = useCart()
  const ran = useRef(false)

  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currency, setCurrency] = useState('USD')
  const [lines, setLines] = useState<Line[]>([])

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const rawId = sp.get('session_id')
    if (!rawId) {
      router.replace('/')
      return
    }

    const id = encodeURIComponent(rawId)
    const ac = new AbortController()

    ;(async () => {
      try {
        const res = await fetch(`/api/admin/session/${id}`, {
          signal: ac.signal,
        })
        const data = await res.json()

        if (!res.ok) {
          toast.error(data?.error || 'Could not load order')
          return
        }

        const s: StripeSession | undefined = data?.session
        if (!s) {
          toast.error('Session not found')
          return
        }

        const lns: Line[] =
          s.line_items?.data.map((li) => {
            const title =
              li.description ??
              (li.price?.product as Stripe.Product | null)?.name ??
              'Item'
            const qty = li.quantity ?? 0
            const unit = (li.price?.unit_amount ?? 0) / 100
            const curr =
              li.price?.currency?.toUpperCase?.() ||
              s.currency?.toUpperCase?.() ||
              'USD'
            return { title, qty, amount: unit * qty, currency: curr }
          }) ?? []

        setLines(lns)
        setTotal((s.amount_total ?? 0) / 100)
        setCurrency((s.currency ?? 'usd').toUpperCase())

        if (s.payment_status === 'paid') {
          clear()
          toast.success('Payment successful. Your cart was cleared.')
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          console.error(e)
          toast.error('Failed to load order')
        }
      } finally {
        setLoading(false)
      }
    })()

    return () => ac.abort()
  }, [sp, clear, router])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="h-6 w-40 bg-slate-200 rounded mb-3 animate-pulse" />
        <div className="h-4 w-64 bg-slate-200 rounded mb-2 animate-pulse" />
        <div className="h-32 w-full bg-slate-100 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Order received 🎉</h1>
      <p className="text-zinc-600 mb-4">
        Thank you for your purchase. A confirmation has been sent if you used an
        email.
      </p>

      <div className="rounded-xl border p-4">
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="text-sm">
                {l.title} <span className="text-zinc-500">× {l.qty}</span>
              </div>
              <div className="text-sm font-medium">
                {fmt(l.amount, l.currency)}
              </div>
            </div>
          ))}
          <div className="border-t my-2" />
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-600">Total</div>
            <div className="text-base font-semibold">
              {fmt(total, currency)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Link href="/" className="rounded-xl bg-black text-white px-4 py-2">
            Continue shopping
          </Link>
          <Link href="/user/orders" className="rounded-xl border px-4 py-2">
            View my orders
          </Link>
        </div>
      </div>
    </div>
  )
}
