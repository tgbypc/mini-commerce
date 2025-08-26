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

  // Some Stripe test flows fire only `payment_intent.succeeded`.
  // Our inventory/order logic is based on Checkout Sessions, so we just acknowledge this event.
  if (event.type === 'payment_intent.succeeded') {
    return NextResponse.json({ received: true })
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session
    const full = await stripe.checkout.sessions.retrieve(s.id, {
      expand: ['line_items.data.price.product'],
    })

    const items: Array<{
      productId: string | null
      title: string
      quantity: number
      unitAmount: number | null | undefined
      currency: string
    }> = []

    for (const li of full.line_items?.data ?? []) {
      const priceObj = li.price as Stripe.Price | null | undefined
      const firestoreIdFromPrice =
        (priceObj?.metadata?.productId as string | undefined) ??
        (priceObj?.metadata?.firestoreId as string | undefined) ??
        null

      let productObj: Stripe.Product | null = null
      let firestoreId: string | null = firestoreIdFromPrice

      // If price metadata didn't carry the id, fall back to product metadata
      if (!firestoreId) {
        const priceProduct = li.price?.product
        if (priceProduct && typeof priceProduct === 'string') {
          try {
            productObj = await stripe.products.retrieve(priceProduct)
          } catch {
            productObj = null
          }
        } else {
          productObj = (priceProduct as Stripe.Product) ?? null
        }

        firestoreId =
          ((productObj?.metadata?.firestoreId as string | undefined) ??
            (productObj?.metadata?.productId as string | undefined) ??
            null)
      }

      items.push({
        productId: firestoreId,
        title: li.description ?? productObj?.name ?? 'Item',
        quantity: li.quantity ?? 0,
        unitAmount: li.price?.unit_amount,
        currency: li.price?.currency ?? full.currency ?? s.currency ?? 'usd',
      })
    }

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

    // stok düş (transaction ile; availabilityStatus güncelle)
    for (const it of items) {
      if (!it.productId || !it.quantity) continue
      const pref = adminDb.collection('products').doc(String(it.productId))
      await adminDb.runTransaction(async (t) => {
        const snap = await t.get(pref)
        const current = (snap.get('stock') as number | undefined) ?? 0
        const newStock = Math.max(0, current - it.quantity!)
        const newStatus = newStock > 0 ? 'in-stock' : 'out-of-stock'
        t.update(pref, { stock: newStock, availabilityStatus: newStatus })
      })
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

    // Optional: clear user's cart after successful payment
    try {
      const uid = s.metadata?.userId
      if (uid) {
        // 1) Common pattern: top-level carts collection
        await adminDb.collection('carts').doc(String(uid)).delete().catch(() => {})

        // 2) Alternative pattern: users/{uid}/cart document
        await adminDb.collection('users').doc(String(uid)).collection('cart').get().then(async (snap) => {
          if (!snap.empty) {
            const delBatch = adminDb.batch()
            for (const d of snap.docs) delBatch.delete(d.ref)
            await delBatch.commit()
          }
        }).catch(() => {})

        // 3) Alternative pattern: users/{uid}/cartItems subcollection
        await adminDb.collection('users').doc(String(uid)).collection('cartItems').get().then(async (snap) => {
          if (!snap.empty) {
            const delBatch = adminDb.batch()
            for (const d of snap.docs) delBatch.delete(d.ref)
            await delBatch.commit()
          }
        }).catch(() => {})
      }
    } catch {
      // cart cleanup is best-effort; ignore errors
    }
  }

  return NextResponse.json({ received: true })
}