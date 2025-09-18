import { NextResponse } from 'next/server'
import { adminDb, auth, FieldValue } from '@/lib/firebaseAdmin'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'
import { extractShippingDetails, toShippingInfo } from '@/app/api/user/orders/shipping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function extractBearer(req: Request): string | null {
  try {
    const h = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    if (!h) return null
    if (h.startsWith('Bearer ')) return h.slice(7).trim()
    return h.trim() || null
  } catch {
    return null
  }
}

type StripeSession = Stripe.Checkout.Session

export async function POST(req: Request) {
  try {
    const token = extractBearer(req)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await auth.verifyIdToken(token)
    const uid = decoded.uid

    const body = await req.json().catch(() => ({})) as { id?: string }
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Missing session id' }, { status: 400 })

    // Load Stripe session with items
    const rawSession = await stripe.checkout.sessions.retrieve(id, {
      expand: ['line_items.data.price.product', 'shipping_cost.shipping_rate'],
    })
    const session = rawSession as StripeSession
    const shippingCost = session.shipping_cost ?? null
    const shippingDetails = extractShippingDetails(session)

    const paid =
      session.payment_status === 'paid' ||
      session.status === 'complete' ||
      (typeof session.payment_intent === 'object' &&
        (session.payment_intent as Stripe.PaymentIntent | null)?.status === 'succeeded')
    if (!paid) return NextResponse.json({ error: 'Session not paid' }, { status: 400 })

    const items = (session.line_items?.data ?? []).map((li) => {
      const priceObj = li.price as Stripe.Price | null | undefined
      const productMeta = priceObj?.product
      let firestoreId: string | null =
        (priceObj?.metadata?.productId as string | undefined) ??
        (priceObj?.metadata?.firestoreId as string | undefined) ??
        null
      let productName: string | null = li.description ?? null
      if (!firestoreId) {
        if (productMeta && typeof productMeta === 'object') {
          firestoreId =
            ((productMeta as Stripe.Product)?.metadata?.firestoreId as string | undefined) ??
            ((productMeta as Stripe.Product)?.metadata?.productId as string | undefined) ??
            null
          productName = productName ?? ((productMeta as Stripe.Product)?.name ?? null)
        }
      }
      return {
        productId: firestoreId,
        title: productName ?? 'Item',
        quantity: li.quantity ?? 0,
        unitAmount: li.price?.unit_amount ?? null,
        currency: li.price?.currency ?? session.currency ?? 'usd',
      }
    })

    const orderDoc = {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: 'paid',
      amountTotal: (session.amount_total ?? 0) / 100,
      currency: session.currency ?? 'usd',
      email: session.customer_details?.email ?? null,
      userId: uid,
      items,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      source: 'ensure',
      shipping: toShippingInfo({
        cost: shippingCost,
        details: shippingDetails,
        customer: session.customer_details ?? null,
      }),
    }

    const orderRef = adminDb.collection('orders').doc(session.id)
    const userOrderRef = adminDb.collection('users').doc(uid).collection('orders').doc(session.id)

    let created = false
    await adminDb.runTransaction(async (t) => {
      const existing = await t.get(orderRef)
      if (existing.exists) {
        // Ensure user subdoc exists
        const userExisting = await t.get(userOrderRef)
        if (!userExisting.exists) t.set(userOrderRef, existing.data() || {})
        return
      }
      // Decrement stock for each item that maps to a product
      for (const it of items) {
        if (!it.productId || !it.quantity) continue
        const pRef = adminDb.collection('products').doc(String(it.productId))
        const pSnap = await t.get(pRef)
        const current = (pSnap.get('stock') as number | undefined) ?? 0
        const newStock = Math.max(0, current - (it.quantity || 0))
        const newStatus = newStock > 0 ? 'in-stock' : 'out-of-stock'
        t.update(pRef, { stock: newStock, availabilityStatus: newStatus })
      }
      t.set(orderRef, orderDoc)
      t.set(userOrderRef, orderDoc)
      created = true
    })

    return NextResponse.json({ id: session.id, created })
  } catch (e) {
    console.error('[orders:ensure] error', e)
    return NextResponse.json({ error: 'Failed to ensure order' }, { status: 500 })
  }
}
