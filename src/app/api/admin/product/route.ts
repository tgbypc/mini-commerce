// src/app/api/product/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe init
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}


// Client formundaki kategoriler ile birebir
const CATEGORIES = [
  'cosmetics',
  'electronics',
  'clothing',
  'home-kitchen',
  'games',
  'books',
] as const
type Category = (typeof CATEGORIES)[number]

// Yardımcılar
const isCsvOfUrls = (val?: string) => {
  const s = (val ?? '').trim()
  if (!s) return true
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean)
  if (parts.length === 0) return true
  return parts.every((u) => {
    try {
      const parsed = new URL(u)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  })
}
const categorySchema = z
  .string()
  .refine((v): v is Category => (CATEGORIES as readonly string[]).includes(v), {
    message: 'Choose a valid category',
  })

const BodySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 chars'),
  price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  stock: z.coerce.number().int().min(0, 'Stock must be 0 or greater'),
  category: categorySchema,
  brand: z.string().max(50).optional().or(z.literal('')),
  thumbnail: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => {
      const s = (v ?? '').trim()
      if (!s) return true
      try {
        const u = new URL(s)
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    }, { message: 'Invalid URL' }),
  // UI string → server’da diziye çevireceğiz ama yine de doğrulayalım
  images: z.string().optional().default('').refine(isCsvOfUrls, {
    message: 'Images must be comma-separated HTTP/HTTPS URLs',
  }),
  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description is too long')
    .optional()
    .or(z.literal('')),
  tags: z.string().optional().default(''),
})

type Body = z.infer<typeof BodySchema>

function csvToArray(s?: string): string[] {
  return (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as unknown
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Invalid request body'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const body: Body = parsed.data
    const images = csvToArray(body.images)
    const tags = csvToArray(body.tags)

    // Firestore numeric id (Stripe metadata için önce üret)
    const numericId = Date.now()
    // --- Stripe: Product & Price ---
    const stripeProduct = await stripe.products.create({
      name: body.title,
      description:
        body.description && body.description.length >= 50
          ? body.description
          : undefined,
      images: images.length ? images : (body.thumbnail ? [body.thumbnail] : undefined),
      metadata: {
        productId: String(numericId),
        category: body.category,
        brand: body.brand || '',
      },
    })
    const stripePrice = await stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(body.price * 100),
      product: stripeProduct.id,
    })

    // --- Firestore: ürün ---
    

    const productDoc = {
      id: numericId,
      title: body.title,
      description: body.description ?? '',
      category: body.category,
      price: body.price,
      thumbnail: body.thumbnail ?? '',
      images,
      stock: typeof body.stock === 'number' && body.stock >= 0 ? body.stock : 10,
      brand: body.brand ?? '',
      tags,
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