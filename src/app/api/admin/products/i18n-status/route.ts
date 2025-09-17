import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req)
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

  try {
    let ids: string[] | null = null
    try {
      const body = await req.json()
      if (body && Array.isArray(body.ids)) ids = body.ids.map((x: unknown) => String(x))
    } catch {}

    let docs
    if (ids && ids.length > 0) {
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))
      const results: FirebaseFirestore.QueryDocumentSnapshot[] = []
      for (const grp of chunks) {
        const qs = await adminDb.collection('products').where(adminDb.firestore.FieldPath.documentId(), 'in', grp).get()
        results.push(...qs.docs)
      }
      docs = results
    } else {
      const snap = await adminDb.collection('products').get()
      docs = snap.docs
    }

    const rows = docs.map((d) => {
      const data = d.data() as Record<string, unknown>
      const en = typeof data['title_en'] === 'string' && (data['title_en'] as string).trim().length > 0
      const nb = typeof data['title_nb'] === 'string' && (data['title_nb'] as string).trim().length > 0
      return { id: d.id, en, nb }
    })

    return NextResponse.json({ items: rows })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load i18n status'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

