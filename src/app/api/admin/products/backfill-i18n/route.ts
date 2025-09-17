import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const gate = await requireAdminFromRequest(req)
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const url = new URL(req.url)
    const mode = url.searchParams.get('mode') || 'copy-base-to-en'

    let processed = 0
    let updated = 0
    let skipped = 0

    const snap = await adminDb.collection('products').get()
    let batch = adminDb.batch()
    let ops = 0

    for (const d of snap.docs) {
      processed++
      const data = d.data() as Record<string, unknown>
      const baseTitle = typeof data.title === 'string' ? (data.title as string).trim() : ''
      const baseDesc = typeof data.description === 'string' ? (data.description as string).trim() : ''
      const titleEn = typeof data.title_en === 'string' ? (data.title_en as string).trim() : ''
      const descEn = typeof data.description_en === 'string' ? (data.description_en as string).trim() : ''

      const patch: Record<string, unknown> = {}

      if (mode === 'copy-base-to-en' || mode === 'both') {
        if (!titleEn && baseTitle) patch['title_en'] = baseTitle
        if (!descEn && baseDesc) patch['description_en'] = baseDesc
        // align base with en if en exists
        if (titleEn) patch['title'] = titleEn
        if (descEn) patch['description'] = descEn
      }

      if (Object.keys(patch).length === 0) {
        skipped++
        continue
      }

      patch['updatedAt'] = FieldValue.serverTimestamp()
      batch.update(d.ref, patch)
      ops++
      updated++

      if (ops >= 400) {
        await batch.commit()
        batch = adminDb.batch()
        ops = 0
      }
    }

    if (ops > 0) await batch.commit()

    return NextResponse.json({ ok: true, processed, updated, skipped, mode })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Backfill failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
