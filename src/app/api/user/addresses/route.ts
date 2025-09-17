import { NextResponse } from 'next/server'
import { adminDb, auth, FieldValue } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tokenFrom(req: Request) {
  const h = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  if (h?.startsWith('Bearer ')) return h.slice(7).trim()
  if (h) return h.trim()
  return null
}

export async function GET(req: Request) {
  try {
    const t = tokenFrom(req)
    if (!t) return NextResponse.json({ items: [] })
    const d = await auth.verifyIdToken(t)
    const uid = d.uid
    const snap = await adminDb.collection('users').doc(uid).collection('addresses').orderBy('createdAt', 'desc').get()
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: Request) {
  try {
    const t = tokenFrom(req)
    if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const d = await auth.verifyIdToken(t)
    const uid = d.uid
    const body = (await req.json()) as Partial<{
      id: string
      name: string
      phone?: string
      line1: string
      line2?: string
      city: string
      state?: string
      zip: string
      country: string
      isDefault?: boolean
    }>
    const id = (body.id || '').trim()
    const doc = {
      name: (body.name || '').trim(),
      phone: (body.phone || '').trim() || null,
      line1: (body.line1 || '').trim(),
      line2: (body.line2 || '').trim() || null,
      city: (body.city || '').trim(),
      state: (body.state || '').trim() || null,
      zip: (body.zip || '').trim(),
      country: (body.country || '').trim().toUpperCase(),
      isDefault: !!body.isDefault,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (!doc.name || !doc.line1 || !doc.city || !doc.zip || !doc.country) {
      return NextResponse.json({ error: 'Missing required' }, { status: 400 })
    }
    const col = adminDb.collection('users').doc(uid).collection('addresses')
    const ref = id ? col.doc(id) : col.doc()

    const batch = adminDb.batch()
    if (!id) {
      batch.set(ref, { ...doc, createdAt: FieldValue.serverTimestamp() })
    } else {
      batch.set(ref, doc, { merge: true })
    }
    if (doc.isDefault) {
      const all = await col.get()
      for (const d of all.docs) {
        if (d.id !== ref.id && d.get('isDefault') === true) {
          batch.update(d.ref, { isDefault: false, updatedAt: FieldValue.serverTimestamp() })
        }
      }
    }
    await batch.commit()
    return NextResponse.json({ id: ref.id, ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

