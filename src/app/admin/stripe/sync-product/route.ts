// src/app/api/admin/stripe/sync-product/route.ts
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'



export async function POST(req: Request) {
  try {
    const { id } = await req.json() as { id: string | number }
    const docId = String(id)
    const ref = adminDb.collection('products').doc(docId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const data = snap.data() as {
      title?: string
      description?: string
      images?: string[]
      thumbnail?: string
      price?: number
      stripeProductId?: string
      stripePriceId?: string
    }

    const name = data.title ?? `Product ${docId}`
    const description = data.description ?? ''
    const image = (data.images && data.images[0]) || data.thumbnail
    const price = Number(data.price) || 0

    // 1) Stripe Product
    let stripeProductId = data.stripeProductId
    if (!stripeProductId) {
      const p = await stripe.products.create({
        name,
        description,
        images: image ? [image] : undefined,
        metadata: { productId: docId },
      })
      stripeProductId = p.id
    } else {
      // İsim/görsel değişmişse güncelle (opsiyonel)
      await stripe.products.update(stripeProductId, {
        name,
        description,
        images: image ? [image] : undefined,
      })
    }

    // 2) Stripe Price (varolan price değişmiş ise yeni price oluşturulur)
    let stripePriceId = data.stripePriceId
    let mustCreateNewPrice = true

    if (stripePriceId) {
      try {
        const existing = await stripe.prices.retrieve(stripePriceId)
        const desired = Math.round(price * 100)
        // unit_amount eşitse yeniden price oluşturma
        if (existing.unit_amount === desired && existing.active) {
          mustCreateNewPrice = false
        } else {
          // Eski price'ı pasif yap (opsiyonel)
          if (existing.active) {
            await stripe.prices.update(existing.id, { active: false })
          }
        }
      } catch {
        // price yoksa yeniden oluşturacağız
      }
    }

    if (mustCreateNewPrice) {
      const pr = await stripe.prices.create({
        currency: 'usd',
        unit_amount: Math.round(price * 100),
        product: stripeProductId,
      })
      stripePriceId = pr.id
    }

    await ref.update({ stripeProductId, stripePriceId })

    return NextResponse.json({ ok: true, stripeProductId, stripePriceId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'sync failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}