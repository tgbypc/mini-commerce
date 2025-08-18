// src/app/cart/checkout/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type CartItem = {
  productId: string
  title: string
  price: number
  quantity: number
}

function getBaseUrl(req: Request) {
  // Prefer header Origin (works both local & prod), fallback to env, then localhost
  return req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment')
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

export async function POST(req: Request) {
  try {
    // Body MUST be JSON from client
    let payload: unknown
    try {
      payload = await req.json()
    } catch {
      return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 })
    }

    const { items, userId } = (payload ?? {}) as {
      items?: CartItem[]
      userId?: string | null
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    const sanitized = items.map((it, idx) => {
      const productId = String(it.productId ?? '')
      const title = String(it.title ?? 'Item')
      const price = Number(it.price)
      const quantity = Math.max(1, Number(it.quantity) || 1)

      if (!productId) throw new Error(`items[${idx}].productId is required`)
      if (!Number.isFinite(price) || price < 0) throw new Error(`items[${idx}].price must be a non-negative number`)

      return { productId, title, price, quantity }
    })

    const origin = getBaseUrl(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: sanitized.map((it) => ({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(it.price * 100),
          product_data: {
            name: it.title,
            metadata: { productId: it.productId }, // webhook için önemli
          },
        },
        quantity: it.quantity,
      })),
      metadata: userId ? { userId } : undefined,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[checkout] error:', error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}