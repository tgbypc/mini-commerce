import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req)
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

  try {
    const snap = await adminDb.collection('products').get()
    let updated = 0
    let skipped = 0
    let batch = adminDb.batch()
    let ops = 0

    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>
      const te = (typeof data.title_en === 'string' ? (data.title_en as string) : (typeof data.title === 'string' ? (data.title as string) : '')).trim()
      const tn = (typeof data.title_nb === 'string' ? (data.title_nb as string) : (typeof data.title === 'string' ? (data.title as string) : '')).trim()
      const currentEn = typeof data.title_en_lc === 'string' ? (data.title_en_lc as string) : ''
      const currentNb = typeof data.title_nb_lc === 'string' ? (data.title_nb_lc as string) : ''

      const patch: Record<string, unknown> = {}
      if (!currentEn && te) patch.title_en_lc = te.toLowerCase()
      if (!currentNb && tn) patch.title_nb_lc = tn.toLowerCase()
      if (Object.keys(patch).length === 0) { skipped++; continue }
      patch.updatedAt = FieldValue.serverTimestamp()
      batch.update(d.ref, patch)
      ops++; updated++
      if (ops >= 400) { await batch.commit(); batch = adminDb.batch(); ops = 0 }
    }

    if (ops > 0) await batch.commit()
    return NextResponse.json({ ok: true, updated, total: snap.size, skipped })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Backfill failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

