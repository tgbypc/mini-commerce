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
    let qty = Math.floor(Number(body?.qty))
    if (!Number.isFinite(qty)) qty = 1
    qty = Math.max(0, qty)
    if (!productId) return NextResponse.json({ ok: false, error: 'Missing productId' }, { status: 400 })

    const ref = adminDb.collection('users').doc(uid).collection('cartItems').doc(productId)
    if (qty === 0) {
      await ref.delete()
    } else {
      await ref.set({ qty, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

