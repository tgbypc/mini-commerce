import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) {
    return new NextResponse('Missing Stripe signature or webhook secret', { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature'
    return new NextResponse(`Webhook Error: ${msg}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session
    const full = await stripe.checkout.sessions.retrieve(s.id, {
      expand: ['line_items.data.price.product'],
    })

    const items = (full.line_items?.data ?? []).map((li) => {
      const product = li.price?.product as Stripe.Product | null
      return {
        productId: product?.metadata?.productId ?? null,
        title: li.description ?? product?.name ?? 'Item',
        quantity: li.quantity ?? 0,
        unitAmount: li.price?.unit_amount ?? null,
        currency: li.price?.currency ?? full.currency ?? s.currency ?? 'usd',
      }
    })

    const batch = adminDb.batch()
    const orderRef = adminDb.collection('orders').doc()
    const orderDoc = {
      orderId: orderRef.id,
      sessionId: s.id,
      paymentStatus: s.payment_status,
      amountTotal: (s.amount_total ?? 0) / 100,
      currency: s.currency ?? 'usd',
      email: s.customer_details?.email ?? null,
      userId: s.metadata?.userId ?? null,
      items,
      createdAt: FieldValue.serverTimestamp(),
    }

    // stok düş
    for (const it of items) {
      if (!it.productId || !it.quantity) continue
      const pref = adminDb.collection('products').doc(String(it.productId))
      batch.update(pref, { stock: FieldValue.increment(-it.quantity) })
    }

    batch.set(orderRef, orderDoc)

    if (s.metadata?.userId) {
      const uref = adminDb
        .collection('users')
        .doc(String(s.metadata.userId))
        .collection('orders')
        .doc(orderRef.id)
      batch.set(uref, orderDoc)
    }

    await batch.commit()
  }

  return NextResponse.json({ received: true })
}