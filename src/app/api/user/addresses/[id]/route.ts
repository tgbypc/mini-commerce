import { NextResponse } from 'next/server'
import { adminDb, auth } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tokenFrom(req: Request) {
  const h = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  if (h?.startsWith('Bearer ')) return h.slice(7).trim()
  if (h) return h.trim()
  return null
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const t = tokenFrom(req)
    if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const d = await auth.verifyIdToken(t)
    const uid = d.uid
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await adminDb.collection('users').doc(uid).collection('addresses').doc(id).delete()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
