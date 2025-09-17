// src/app/api/product/route.ts
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { productSchema } from '@/lib/validation/products'
import { del as blobDel } from '@vercel/blob'
import { requireAdminFromRequest } from '@/lib/adminAuth'

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
    const gate = await requireAdminFromRequest(req)
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
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
    

    const productDoc: Record<string, unknown> = {
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

    // Optional localized fields if provided by client
    try {
      const { title_en, title_nb, description_en, description_nb } = raw || {}
      const te = typeof title_en === 'string' ? title_en.trim() : ''
      const tn = typeof title_nb === 'string' ? title_nb.trim() : ''
      const de = typeof description_en === 'string' ? description_en.trim() : ''
      const dn = typeof description_nb === 'string' ? description_nb.trim() : ''
      if (te) productDoc['title_en'] = te
      if (tn) productDoc['title_nb'] = tn
      if (de) productDoc['description_en'] = de
      if (dn) productDoc['description_nb'] = dn
      // Lowercase keys for case-insensitive search
      if (te) productDoc['title_en_lc'] = te.toLowerCase()
      if (tn) productDoc['title_nb_lc'] = tn.toLowerCase()
      // Set base fields from default locale (en) for fallback/search
      if (te) productDoc['title'] = te
      if (de) productDoc['description'] = de
    } catch {}

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

export async function PUT(req: Request) {
  try {
    const gate = await requireAdminFromRequest(req)
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const raw = await req.json()

    const normalized = {
      // required for update
      id: deArray(raw.id),

      // full form payload (we expect full fields from the edit form)
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

    // Basic guard
    const id = normalized.id
    if (!id) {
      return NextResponse.json({ error: 'Missing product id' }, { status: 400 })
    }

    // Validate the rest of the payload using the existing schema
    const input = productSchema.parse({
      title: normalized.title,
      description: normalized.description,
      price: normalized.price,
      stock: normalized.stock,
      category: normalized.category,
      brand: normalized.brand,
      thumbnail: normalized.thumbnail,
      images: normalized.images,
      tags: normalized.tags,
    })

    // --- Load existing product ---
    const ref = adminDb.collection('products').doc(String(id))
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    const existing = snap.data() as {
      stripeProductId?: string
      stripePriceId?: string
      price?: number
    }

    // --- Stripe: Update product details ---
    if (existing?.stripeProductId) {
      await stripe.products.update(existing.stripeProductId, {
        name: input.title,
        description:
          input.description && input.description.length >= 50
            ? input.description
            : undefined,
        images: input.images.length
          ? input.images
          : input.thumbnail
          ? [input.thumbnail]
          : undefined,
        metadata: {
          productId: String(id),
          category: input.category,
          brand: input.brand || '',
        },
      })
    }

    // --- Stripe: If price changed, create a new Price (prices are immutable) ---
    let newStripePriceId: string | undefined = undefined
    const priceChanged =
      typeof existing?.price === 'number' &&
      Number(existing.price) !== Number(input.price)

    if (existing?.stripeProductId && priceChanged) {
      // Create a new active price
      const newPrice = await stripe.prices.create({
        currency: 'usd',
        unit_amount: Math.round(input.price * 100),
        product: existing.stripeProductId,
      })
      newStripePriceId = newPrice.id

      // Optionally deactivate old price
      if (existing?.stripePriceId) {
        try {
          await stripe.prices.update(existing.stripePriceId, { active: false })
        } catch {
          // no-op if cannot deactivate
        }
      }
    }

    // --- Firestore: update product doc ---
    const updateDoc: Record<string, unknown> = {
      title: input.title,
      description: input.description ?? '',
      category: input.category,
      price: input.price,
      thumbnail: input.thumbnail ?? '',
      images: input.images,
      stock:
        typeof input.stock === 'number' && input.stock >= 0
          ? input.stock
          : 0,
      brand: input.brand ?? '',
      tags: input.tags,
      availabilityStatus: (input.stock ?? 0) > 0 ? 'in-stock' : 'out-of-stock',
      'meta.updatedAt': new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    // Optional localized fields on update
    try {
      const { title_en, title_nb, description_en, description_nb } = raw || {}
      const te = typeof title_en === 'string' ? title_en.trim() : ''
      const tn = typeof title_nb === 'string' ? title_nb.trim() : ''
      const de = typeof description_en === 'string' ? description_en.trim() : ''
      const dn = typeof description_nb === 'string' ? description_nb.trim() : ''
      if (title_en !== undefined) {
        updateDoc['title_en'] = te
        updateDoc['title_en_lc'] = te ? te.toLowerCase() : ''
      }
      if (title_nb !== undefined) {
        updateDoc['title_nb'] = tn
        updateDoc['title_nb_lc'] = tn ? tn.toLowerCase() : ''
      }
      if (description_en !== undefined) updateDoc['description_en'] = de
      if (description_nb !== undefined) updateDoc['description_nb'] = dn
      // Keep base fields aligned with default (en) if provided
      if (te) updateDoc['title'] = te
      if (de) updateDoc['description'] = de
    } catch {}
    if (newStripePriceId) {
      updateDoc['stripePriceId'] = newStripePriceId
    }

    await ref.update(updateDoc)

    return NextResponse.json({
      id: String(id),
      stripeProductId: existing?.stripeProductId || null,
      stripePriceId: newStripePriceId ?? existing?.stripePriceId ?? null,
      priceChanged: !!newStripePriceId,
    })
  } catch (err) {
    console.error('[api/product PUT] error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await requireAdminFromRequest(req)
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
    // Support both body JSON and query string (?id=...)
    let id: string | null = null
    try {
      const ct = req.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
        const maybe = (body?.id ?? body?.productId) as string | undefined
        if (maybe) id = String(maybe)
      }
    } catch {/* ignore body parse errors */}

    if (!id) {
      const url = new URL(req.url)
      const qid = url.searchParams.get('id')
      if (qid) id = qid
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing product id' }, { status: 400 })
    }

    const ref = adminDb.collection('products').doc(String(id))
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const data = snap.data() as {
      thumbnail?: string
      images?: string[]
      stripeProductId?: string
      stripePriceId?: string
    }

    // Attempt to delete blob assets if they look like blob URLs
    const blobUrls: string[] = []
    if (typeof data?.thumbnail === 'string' && data.thumbnail.startsWith('https://')) {
      blobUrls.push(data.thumbnail)
    }
    if (Array.isArray(data?.images)) {
      for (const u of data.images) {
        if (typeof u === 'string' && u.startsWith('https://')) blobUrls.push(u)
      }
    }

    if (blobUrls.length) {
      try {
        await blobDel(blobUrls)
      } catch (e) {
        console.warn('[product DELETE] blob delete warning:', e)
      }
    }

    // Optionally deactivate Stripe resources (do not hard-delete)
    if (data?.stripePriceId) {
      try { await stripe.prices.update(data.stripePriceId, { active: false }) } catch {}
    }
    if (data?.stripeProductId) {
      try { await stripe.products.update(data.stripeProductId, { active: false }) } catch {}
    }

    // Finally remove Firestore document
    await ref.delete()

    return NextResponse.json({ id: String(id), deleted: true })
  } catch (err) {
    console.error('[api/product DELETE] error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
