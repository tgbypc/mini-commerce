import { NextResponse } from 'next/server'
import { adminDb, auth } from '@/lib/firebaseAdmin'

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

export async function GET(req: Request) {
  try {
    const token = extractBearer(req)
    if (!token) return NextResponse.json({ items: [] })
    const decoded = await auth.verifyIdToken(token)
    const uid = decoded.uid

    const snap = await adminDb.collection('users').doc(uid).collection('cartItems').get()
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ items: [] })
  }
}

