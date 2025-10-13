import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type FirestoreUpdate = FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>

export async function POST(req: Request) {
  try {
    const gate = await requireAdminFromRequest(req)
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const url = new URL(req.url)
    const mode = url.searchParams.get('mode') || 'copy-base-to-en'
    type LocaleCode = 'en' | 'nb'
    type SourceCode = 'base' | 'en' | 'nb'
    const plan: Array<{ target: LocaleCode; source: SourceCode }> = (() => {
      switch (mode) {
        case 'copy-base-to-nb':
          return [{ target: 'nb', source: 'base' }]
        case 'copy-en-to-nb':
          return [{ target: 'nb', source: 'en' }]
        case 'copy-nb-to-en':
          return [{ target: 'en', source: 'nb' }]
        case 'both':
          return [
            { target: 'en', source: 'base' },
            { target: 'nb', source: 'base' },
          ]
        case 'copy-base-to-en':
        default:
          return [{ target: 'en', source: 'base' }]
      }
    })()

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
      let titleEn = typeof data.title_en === 'string' ? (data.title_en as string).trim() : ''
      let descEn = typeof data.description_en === 'string' ? (data.description_en as string).trim() : ''
      let titleNb = typeof data.title_nb === 'string' ? (data.title_nb as string).trim() : ''
      let descNb = typeof data.description_nb === 'string' ? (data.description_nb as string).trim() : ''

      const patch: FirestoreUpdate = {}

      const getSource = (source: SourceCode) => {
        switch (source) {
          case 'en':
            return { title: titleEn, description: descEn }
          case 'nb':
            return { title: titleNb, description: descNb }
          default:
            return { title: baseTitle, description: baseDesc }
        }
      }

      for (const { target, source } of plan) {
        const sourceValues = getSource(source)
        if (target === 'en') {
          if (!titleEn && sourceValues.title) {
            patch['title_en'] = sourceValues.title
            patch['title_en_lc'] = sourceValues.title.toLowerCase()
            titleEn = sourceValues.title
          }
          if (!descEn && sourceValues.description) {
            patch['description_en'] = sourceValues.description
            descEn = sourceValues.description
          }
        } else {
          if (!titleNb && sourceValues.title) {
            patch['title_nb'] = sourceValues.title
            patch['title_nb_lc'] = sourceValues.title.toLowerCase()
            titleNb = sourceValues.title
          }
          if (!descNb && sourceValues.description) {
            patch['description_nb'] = sourceValues.description
            descNb = sourceValues.description
          }
        }
      }

      if ((mode === 'copy-base-to-en' || mode === 'copy-nb-to-en' || mode === 'both') && titleEn) {
        if (baseTitle !== titleEn) patch['title'] = titleEn
        if (descEn && baseDesc !== descEn) patch['description'] = descEn
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