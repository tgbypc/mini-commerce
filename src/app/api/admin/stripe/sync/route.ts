import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SummaryError = {
  id: string
  message: string
}

type Summary = {
  processed: number
  skipped: number
  updatedDocs: number
  createdProducts: number
  createdPrices: number
  priceReplaced: number
  errors: SummaryError[]
}

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req)
  if ('error' in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const summary: Summary = {
    processed: 0,
    skipped: 0,
    updatedDocs: 0,
    createdProducts: 0,
    createdPrices: 0,
    priceReplaced: 0,
    errors: [],
  }

  try {
    const snap = await adminDb.collection('products').get()
    for (const doc of snap.docs) {
      summary.processed += 1
      const data = doc.data() as Record<string, unknown>
      const id = doc.id

      const title = toOptionalString(data.title)
        ?? toOptionalString(data.title_en)
        ?? toOptionalString(data.title_nb)
      const description = toOptionalString(data.description)
        ?? toOptionalString(data.description_en)
        ?? toOptionalString(data.description_nb)
      const priceValue = toNumber(data.price)
      const imagesRaw = Array.isArray(data.images) ? (data.images as unknown[]) : []
      const images = imagesRaw.filter(
        (img): img is string => typeof img === 'string' && img.trim().length > 0
      )
      const thumbnail = toOptionalString(data.thumbnail)

      if (!title || typeof priceValue !== 'number') {
        summary.skipped += 1
        continue
      }

      const amount = Math.max(0, Math.round(priceValue * 100))
      if (!Number.isFinite(amount) || amount <= 0) {
        summary.skipped += 1
        continue
      }

      const stripeInfo = {
        productId: toOptionalString(data.stripeProductId),
        priceId: toOptionalString(data.stripePriceId),
      }

      const updates: Record<string, unknown> = {}
      let localCreatedProduct = false
      let localCreatedPrice = false
      let localPriceReplaced = false

      try {
        const productImages = images.length > 0 ? images : thumbnail ? [thumbnail] : undefined

        if (!stripeInfo.productId) {
          const created = await stripe.products.create({
            name: title,
            description: description && description.length >= 50 ? description : undefined,
            images: productImages,
            metadata: {
              productId: id,
              category: toOptionalString(data.category) ?? '',
              brand: toOptionalString(data.brand) ?? '',
            },
          })
          stripeInfo.productId = created.id
          updates.stripeProductId = created.id
          localCreatedProduct = true
        } else {
          await stripe.products.update(stripeInfo.productId, {
            name: title,
            description: description && description.length >= 50 ? description : undefined,
            images: productImages,
            active: true,
            metadata: {
              productId: id,
              category: toOptionalString(data.category) ?? '',
              brand: toOptionalString(data.brand) ?? '',
            },
          })
        }

        const createPrice = async () => {
          if (!stripeInfo.productId) {
            throw new Error('Stripe product id eksik')
          }
          const created = await stripe.prices.create({
            currency: 'usd',
            unit_amount: amount,
            product: stripeInfo.productId,
          })
          stripeInfo.priceId = created.id
          updates.stripePriceId = created.id
          localCreatedPrice = true
        }

        if (!stripeInfo.priceId) {
          await createPrice()
        } else {
          try {
            const existing = await stripe.prices.retrieve(stripeInfo.priceId)
            if (existing.unit_amount !== amount || existing.currency !== 'usd') {
              await createPrice()
              localPriceReplaced = true
              try {
                await stripe.prices.update(existing.id, { active: false })
              } catch {
                // price deaktivasyonu başarısız olabilir → görmezden gel
              }
            } else if (!existing.active) {
              await stripe.prices.update(existing.id, { active: true })
            }
          } catch {
            await createPrice()
            localPriceReplaced = true
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = FieldValue.serverTimestamp()
          updates['meta.updatedAt'] = new Date().toISOString()
          await doc.ref.update(updates)
          summary.updatedDocs += 1
        } else {
          summary.skipped += 1
        }

        if (localCreatedProduct) summary.createdProducts += 1
        if (localCreatedPrice) summary.createdPrices += 1
        if (localPriceReplaced) summary.priceReplaced += 1
      } catch (productErr) {
        summary.errors.push({
          id,
          message:
            productErr instanceof Error
              ? productErr.message
              : 'Stripe sync failed',
        })
      }
    }

    return NextResponse.json(summary)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
