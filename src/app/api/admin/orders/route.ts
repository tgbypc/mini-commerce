import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered', 'canceled'] as const
type Status = typeof STATUSES[number]

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req)
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const url = new URL(req.url)
    const status = (url.searchParams.get('status') || '').trim().toLowerCase() as Status | ''
    let q: FirebaseFirestore.Query = adminDb.collection('orders')
    if (status && (STATUSES as readonly string[]).includes(status)) {
      q = q.where('status', '==', status)
    }
    q = q.orderBy('createdAt', 'desc').limit(100)
    const snap = await q.get()
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load orders'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
