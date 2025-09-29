import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'
import { adminDb } from '@/lib/firebaseAdmin'


export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'



// Body şeması
const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
})
const BodySchema = z.object({
  items: z.array(ItemSchema).min(1),
  uid: z.string().optional(),
  email: z.string().email().optional(),
  shippingMethod: z.enum(['standard', 'express']).optional(),
})

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as unknown
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Invalid request body'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { items, uid, email, shippingMethod } = parsed.data

    // Not: Şu an products koleksiyonundan stripePriceId aramıyoruz,
    // price_data ile ilerliyoruz (senin mevcut akışına uyum).
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const line_items: { price: string; quantity: number }[] = []
    for (const it of items) {
      // quantity guard: integer >= 1
      const qty = Math.max(1, Math.floor(it.quantity || 1))

      // Fetch product from Firestore and validate stripePriceId
      const productSnap = await adminDb.collection('products').doc(String(it.productId)).get()
      if (!productSnap.exists) {
        throw new Error(`Product not found: ${it.productId}`)
      }
      const productData = productSnap.data() as { stripePriceId?: unknown }
      const priceId = typeof productData.stripePriceId === 'string' ? productData.stripePriceId : ''
      if (!priceId || !priceId.startsWith('price_')) {
        throw new Error(`Missing or invalid stripePriceId for product: ${it.productId}`)
      }

      line_items.push({ price: priceId, quantity: qty })
    }

    const metadata: Record<string, string> = {}
    if (uid) metadata.uid = uid
    if (shippingMethod) metadata.shippingMethod = shippingMethod

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      locale: 'en',
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ['NO', 'US', 'TR'] },
      shipping_options: [
        { shipping_rate_data: { display_name: 'Standard', fixed_amount: { amount: 500, currency: 'usd' }, type: 'fixed_amount' } },
        { shipping_rate_data: { display_name: 'Express', fixed_amount: { amount: 1200, currency: 'usd' }, type: 'fixed_amount' } },
      ],
      ...(uid && uid.trim().length > 0 ? { client_reference_id: uid } : {}),
      ...(email ? { customer_email: email, customer_creation: 'always' as const } : {}),
      ...(Object.keys(metadata).length ? { metadata } : {}),
      success_url: `${origin}/success?id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
