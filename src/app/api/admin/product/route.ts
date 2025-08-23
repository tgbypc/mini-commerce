// src/app/api/product/route.ts
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { productSchema } from '@/lib/validation/products'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe init
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

const deArray = <T,>(v: T | T[]) => (Array.isArray(v) ? v[0] : v)

export async function POST(req: Request) {
  try {
    const raw = await req.json()

    const normalized = {
      title: deArray(raw.title),
      description: deArray(raw.description),
      price: deArray(raw.price),
      stock: deArray(raw.stock),
      category: deArray(raw.category),
      brand: raw.brand === undefined ? undefined : deArray(raw.brand),
      thumbnail: deArray(raw.thumbnail),
      images: raw.images,
      tags: raw.tags,
    }

    const input = productSchema.parse(normalized)

    // Firestore numeric id (Stripe metadata için önce üret)
    const numericId = Date.now()
    // --- Stripe: Product & Price ---
    const stripeProduct = await stripe.products.create({
      name: input.title,
      description:
        input.description && input.description.length >= 50
          ? input.description
          : undefined,
      images: input.images.length ? input.images : (input.thumbnail ? [input.thumbnail] : undefined),
      metadata: {
        productId: String(numericId),
        category: input.category,
        brand: input.brand || '',
      },
    })
    const stripePrice = await stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(input.price * 100),
      product: stripeProduct.id,
    })

    // --- Firestore: ürün ---
    

    const productDoc = {
      id: numericId,
      title: input.title,
      description: input.description ?? '',
      category: input.category,
      price: input.price,
      thumbnail: input.thumbnail ?? '',
      images: input.images,
      stock: typeof input.stock === 'number' && input.stock >= 0 ? input.stock : 10,
      brand: input.brand ?? '',
      tags: input.tags,
      availabilityStatus: 'in-stock',
      reviews: [],
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        barcode: '',
        qrCode: '',
      },
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const ref = adminDb.collection('products').doc(String(numericId))
    await ref.set(productDoc)

    return NextResponse.json({
      id: numericId,
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id,
    })
  } catch (err) {
    console.error('[api/product POST] error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}