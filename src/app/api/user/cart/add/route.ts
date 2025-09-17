import { NextResponse } from 'next/server'
import { adminDb, auth, FieldValue } from '@/lib/firebaseAdmin'

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

export async function POST(req: Request) {
  try {
    const token = extractBearer(req)
    if (!token) return NextResponse.json({ ok: false }, { status: 401 })
    const decoded = await auth.verifyIdToken(token)
    const uid = decoded.uid
    const body = await req.json()
    const productId = String(body?.productId || '')
    const qty = Math.max(1, Math.floor(Number(body?.qty || 1)))
    if (!productId) return NextResponse.json({ ok: false, error: 'Missing productId' }, { status: 400 })

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
          title: typeof body?.title === 'string' ? body.title : null,
          price: typeof body?.price === 'number' ? body.price : null,
          thumbnail: typeof body?.thumbnail === 'string' ? body.thumbnail : null,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

