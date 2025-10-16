import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered', 'canceled'] as const
type Status = typeof STATUSES[number]
type FirestoreOrderDoc = {
  status?: string | null
} & Record<string, unknown>

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req)
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const url = new URL(req.url)
    const status = (url.searchParams.get('status') || '').trim().toLowerCase() as Status | ''
    const baseQuery = adminDb
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(100)
    const snap = await baseQuery.get()
    const itemsRaw = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as FirestoreOrderDoc),
    }))
    const items =
      status && (STATUSES as readonly string[]).includes(status)
        ? itemsRaw.filter(
            (item) =>
              typeof item.status === 'string' &&
              item.status.toLowerCase() === status
          )
        : itemsRaw
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load orders'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
