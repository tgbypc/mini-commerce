import { NextResponse } from 'next/server'
import { adminDb, auth, FieldValue } from '@/lib/firebaseAdmin'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function extractBearer(req: Request): string | null {
  try {
    const h = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    if (!h) return null
    if (h.startsWith('Bearer ')) return h.slice(7).trim()
    return h.trim() || null
  } catch {
    return null
  }
}

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : value)
const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

const addSchema = z.object({
  productId: z.preprocess(toTrimmedString, z.string().min(1).max(128)),
  qty: z
    .preprocess((v) => Number(v ?? 1), z.number().int().min(1).max(50))
    .default(1),
  title: z.preprocess(toOptionalTrimmedString, z.string().min(1).max(120)).optional(),
  price: z
    .preprocess((v) => (v === null || v === undefined || v === '' ? undefined : Number(v)), z.number().min(0).max(1_000_000))
    .optional(),
  thumbnail: z.preprocess(toOptionalTrimmedString, z.string().url().max(500)).optional(),
})

export async function POST(req: Request) {
  try {
    const token = extractBearer(req)
    if (!token) return NextResponse.json({ ok: false }, { status: 401 })
    const decoded = await auth.verifyIdToken(token)
    const uid = decoded.uid
    const json = await req.json().catch(() => null)
    const parsed = addSchema.safeParse(json)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { ok: false, error: issue?.message || 'Invalid payload' },
        { status: 400 },
      )
    }

    const { productId, qty, title, price, thumbnail } = parsed.data

    const ref = adminDb.collection('users').doc(uid).collection('cartItems').doc(productId)
    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(ref)
      if (snap.exists) {
        const current = (snap.get('qty') as number | undefined) ?? 0
        t.update(ref, { qty: current + qty, updatedAt: FieldValue.serverTimestamp() })
      } else {
        t.set(ref, {
          productId,
          qty,
          title: title ?? null,
          price: typeof price === 'number' ? price : null,
          thumbnail: thumbnail ?? null,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[user/cart/add] failed', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}