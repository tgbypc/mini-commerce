import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'
import { adminDb } from '@/lib/firebaseAdmin'
import type Stripe from 'stripe'
import { pickI18nString } from '@/lib/i18nContent'


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
  locale: z.enum(['en', 'nb']).optional(),
})

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as unknown
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Invalid request body'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { items, uid, email, shippingMethod, locale } = parsed.data

    // Stripe hosted sayfada dinamik, locale uyumlu başlık gösterebilmek için
    // her satırı price_data ile inşa ediyoruz.
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    const activeLocale = locale ?? 'en'
    for (const it of items) {
      // quantity guard: integer >= 1
      const qty = Math.max(1, Math.floor(it.quantity || 1))

      // Firestore'dan ürün detayını çekip fiyat ve lokalize başlık çıkar
      const productSnap = await adminDb.collection('products').doc(String(it.productId)).get()
      if (!productSnap.exists) {
        throw new Error(`Product not found: ${it.productId}`)
      }
      const productData = productSnap.data() as Record<string, unknown>
      const rawPrice = productData.price
      const priceNumber =
        typeof rawPrice === 'number'
          ? rawPrice
          : typeof rawPrice === 'string'
            ? Number(rawPrice)
            : NaN
      if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
        throw new Error(`Missing valid price for product: ${it.productId}`)
      }
      const unitAmount = Math.round(priceNumber * 100)

      const fallbackTitle = activeLocale === 'nb' ? 'Produkt' : 'Product'
      const localizedTitle =
        pickI18nString(productData, 'title', activeLocale) ||
        (typeof productData.title === 'string' && productData.title.trim().length
          ? (productData.title as string)
          : fallbackTitle)

      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          product_data: {
            name: localizedTitle,
            metadata: { productId: String(it.productId) },
          },
        },
      })
    }

    const metadata: Record<string, string> = {}
    if (uid) metadata.uid = uid
    if (shippingMethod) metadata.shippingMethod = shippingMethod

    const stripeLocale = activeLocale === 'nb' ? 'nb' : activeLocale === 'en' ? 'en' : 'auto'

    const shippingLabel = activeLocale === 'nb'
      ? { standard: 'Standard (3-5 dager)', express: 'Ekspress (1-2 dager)' }
      : { standard: 'Standard', express: 'Express' }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      locale: stripeLocale,
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ['NO', 'US', 'TR'] },
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: shippingLabel.standard,
            fixed_amount: { amount: 500, currency: 'usd' },
            type: 'fixed_amount',
          },
        },
        {
          shipping_rate_data: {
            display_name: shippingLabel.express,
            fixed_amount: { amount: 1200, currency: 'usd' },
            type: 'fixed_amount',
          },
        },
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
