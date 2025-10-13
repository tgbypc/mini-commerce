import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'read', 'archived'] as const

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req)
  if ('error' in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const url = new URL(req.url)
    const status = (url.searchParams.get('status') || '').trim().toLowerCase()
    let q: FirebaseFirestore.Query = adminDb.collection('contactMessages')

    if (status && (STATUSES as readonly string[]).includes(status)) {
      q = q.where('status', '==', status)
    }

    q = q.orderBy('createdAt', 'desc').limit(100)

    const snap = await q.get()
    const items = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>
      return {
        id: d.id,
        ...(data ?? {}),
      }
    })

    return NextResponse.json({ items })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load contact messages'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
