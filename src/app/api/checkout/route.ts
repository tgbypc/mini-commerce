import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'



// Body şeması
const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
})
const BodySchema = z.object({
  items: z.array(ItemSchema).min(1),
  userId: z.string().optional(), // (login işini ekleyince dolduracağız)
})

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as unknown
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Invalid request body'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { items, userId } = parsed.data

    // Not: Şu an products koleksiyonundan stripePriceId aramıyoruz,
    // price_data ile ilerliyoruz (senin mevcut akışına uyum).
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const line_items: { price: string; quantity: number }[] = []
    for (const it of items) {
      // quantity guard: integer >= 1
      const qty = Math.max(1, Math.floor(it.quantity || 1))

      // Fetch product from Firestore and validate stripePriceId
      const productRef = doc(db, 'products', it.productId)
      const productSnap = await getDoc(productRef)
      if (!productSnap.exists()) {
        throw new Error(`Product not found: ${it.productId}`)
      }
      const productData = productSnap.data() as { stripePriceId?: unknown }
      const priceId = typeof productData.stripePriceId === 'string' ? productData.stripePriceId : ''
      if (!priceId || !priceId.startsWith('price_')) {
        throw new Error(`Missing or invalid stripePriceId for product: ${it.productId}`)
      }

      line_items.push({ price: priceId, quantity: qty })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      allow_promotion_codes: true,
      metadata: userId ? { userId } : undefined,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
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