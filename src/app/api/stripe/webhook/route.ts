import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { sendEmail } from '@/lib/email'
import {
  extractShippingDetails,
  toShippingInfo,
  type ShippingInfo,
} from '@/app/api/user/orders/shipping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

type StripeSession = Stripe.Checkout.Session
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

    // Derive uid from client_reference_id or metadata.uid (set at checkout creation)
    const uid: string | null =
      (s.client_reference_id as string | null) ??
      (s.metadata?.uid as string | undefined) ??
      null

    const rawSession = await stripe.checkout.sessions.retrieve(s.id, {
      expand: ['line_items.data.price.product', 'shipping_cost.shipping_rate'],
    })
    const full = rawSession as StripeSession

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
    const orderRef = adminDb.collection('orders').doc(s.id)
    const shipping: ShippingInfo = toShippingInfo({
      cost: full.shipping_cost ?? null,
      details: extractShippingDetails(full),
      customer: full.customer_details ?? null,
    })

    const customerEmail = s.customer_details?.email ?? null
    const emailLc = customerEmail ? customerEmail.toLowerCase() : null

    const orderDoc = {
      sessionId: s.id,
      paymentStatus: s.payment_status,
      status: 'paid',
      amountTotal: (s.amount_total ?? 0) / 100,
      currency: s.currency ?? 'usd',
      email: customerEmail,
      emailLc,
      userId: uid,
      items,
      shipping,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      source: 'webhook' as const,
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

    if (uid) {
      const uref = adminDb
        .collection('users')
        .doc(String(uid))
        .collection('orders')
        .doc(s.id)
      batch.set(uref, orderDoc)
    }

    await batch.commit()

    // Optional: clear user's cart after successful payment
    try {
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

    // Best-effort: send order confirmation email (Ethereal preview via Nodemailer)
    try {
      const toEmail = s.customer_details?.email ?? null
      if (toEmail) {
        const currency = (orderDoc.currency as string | undefined)?.toUpperCase() || 'USD'
        const rows = items
          .map((it) => {
            const qty = it.quantity ?? 0
            const unit = typeof it.unitAmount === 'number' ? (it.unitAmount / 100).toFixed(2) : ''
            const title = it.title || 'Item'
            return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${title}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${qty}</td><td style=\"padding:6px 8px;border-bottom:1px solid #eee\">${unit} ${currency}</td></tr>`
          })
          .join('')

        const html = `
          <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto">
            <h2 style="margin:0 0 12px">Your Order Is Confirmed</h2>
            <p style="margin:0 0 12px">Order No.: <strong>${s.id}</strong></p>
            <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;min-width:300px">
              <thead>
                <tr>
                  <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333">Product</th>
                  <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333">Quantity</th>
                  <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333">Unit</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="margin:12px 0 0">Total: <strong>${(orderDoc.amountTotal as number).toFixed(2)} ${currency}</strong></p>
          </div>`

        const sendResult = await sendEmail({
          to: toEmail,
          subject: `Order Confirmation #${s.id}`,
          html,
          text: `Your order has been confirmed. Order No.: ${s.id}. Total: ${(orderDoc.amountTotal as number).toFixed(2)} ${currency}`,
        })

        if (!sendResult.ok) {
          console.error('Order confirmation email send failed', sendResult.error)
        } else if (sendResult.previewUrl) {
          console.log('Order confirmation email preview URL', sendResult.previewUrl)
        }
      }
    } catch (err) {
      console.error('Order confirmation email error', err)
    }
  }

  return NextResponse.json({ received: true })
}
