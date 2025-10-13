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

const payloadSchema = z.object({
  productId: z
    .preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1).max(128)),
  qty: z
    .preprocess((v) => Number(v ?? 0), z.number().int().min(0).max(50))
    .default(0),
})

export async function POST(req: Request) {
  try {
    const token = extractBearer(req)
    if (!token) return NextResponse.json({ ok: false }, { status: 401 })
    const decoded = await auth.verifyIdToken(token)
    const uid = decoded.uid
    const json = await req.json().catch(() => null)
    const parsed = payloadSchema.safeParse(json)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { ok: false, error: issue?.message || 'Invalid payload' },
        { status: 400 },
      )
    }

    const { productId, qty } = parsed.data

    const ref = adminDb.collection('users').doc(uid).collection('cartItems').doc(productId)
    if (qty === 0) {
      await ref.delete()
    } else {
      await ref.set({ qty, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[user/cart/update] failed', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}