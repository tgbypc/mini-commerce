import { NextResponse } from 'next/server'
import 'server-only'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { stripe } from '@/lib/stripe'
import { db } from '@/lib/firebase'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore'

// Minimal product shape we rely on
type ProductDoc = {
  id?: string
  title?: string
  description?: string
  price?: number | string
  thumbnail?: string | null
  images?: string[] | null
  image?: string | null // legacy
  stripeProductId?: string | null
  stripePriceId?: string | null
  stripe?: { productId?: string | null; priceId?: string | null } | null
}

const parsePriceCents = (price: unknown): number | null => {
  if (typeof price === 'number' && Number.isFinite(price)) return Math.round(price * 100)
  if (typeof price === 'string') {
    const n = Number.parseFloat(price)
    if (Number.isFinite(n)) return Math.round(n * 100)
  }
  return null
}

export async function POST(req: Request) {
  try {
    let onlyId: string | null = null
    try {
      const body = await req.json()
      if (body && typeof body.id !== 'undefined') {
        onlyId = String(body.id)
      }
    } catch {
      // no body or not JSON; treat as bulk
    }

    const snap = await getDocs(collection(db, 'products'))

    const processed: string[] = []
    const skipped: string[] = []
    const updated: Array<{ id: string; productId: string; priceId: string }> = []
    const errors: Array<{ id: string; error: string }> = []

    for (const d of snap.docs) {
      const data = d.data() as ProductDoc
      const id = d.id

      if (onlyId && id !== onlyId) {
        continue
      }

      // Prefer legacy nested fields if top-level are missing
      const existingProductId = data.stripeProductId ?? data.stripe?.productId ?? null
      const existingPriceId = data.stripePriceId ?? data.stripe?.priceId ?? null

      const hasProduct = !!existingProductId
      const hasPrice = !!existingPriceId

      if (hasProduct && hasPrice) {
        skipped.push(id)
        continue
      }

      const name = (data.title ?? '').toString().trim()
      // Compose images array from thumbnail, images[], and legacy image
      const imageCandidates: string[] = []
      if (data.thumbnail) imageCandidates.push(data.thumbnail)
      if (Array.isArray(data.images)) imageCandidates.push(...data.images)
      if (data.image) imageCandidates.push(data.image)
      const images = imageCandidates.filter((u) => typeof u === 'string' && u.length > 0).slice(0, 8)
      // Parse price using helper
      const amount = parsePriceCents(data.price)

      if (!name || amount === null) {
        errors.push({ id, error: 'Missing name or price' })
        continue
      }

      try {
        // Create Stripe Product if needed
        let stripeProductId = existingProductId
        if (!stripeProductId) {
          const prod = await stripe.products.create({
            name,
            description: data.description ?? undefined,
            images: images.length ? images : undefined,
          })
          stripeProductId = prod.id
        }

        // Create Stripe Price if needed (USD, one-time)
        let stripePriceId = existingPriceId
        if (!stripePriceId) {
          const price = await stripe.prices.create({
            currency: 'usd',
            unit_amount: amount,
            product: (stripeProductId as string),
          })
          stripePriceId = price.id
        }

        // Write both top-level and nested stripe fields
        await updateDoc(doc(db, 'products', id), {
          stripeProductId,
          stripePriceId,
          stripe: { productId: stripeProductId, priceId: stripePriceId },
        })

        updated.push({ id, productId: stripeProductId as string, priceId: stripePriceId as string })
        processed.push(id)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Stripe sync failed'
        errors.push({ id, error: msg })
      }
    }

    return NextResponse.json({
      ok: true,
      mode: onlyId ? 'single' : 'bulk',
      targetId: onlyId,
      total: onlyId ? (processed.length + skipped.length + errors.length) : snap.size,
      processed: processed.length,
      skipped: skipped.length,
      updated,
      skippedIds: skipped,
      errors,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}