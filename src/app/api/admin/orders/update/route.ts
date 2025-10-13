import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'
import type { DocumentData, PartialWithFieldValue, UpdateData } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered', 'canceled'] as const
type Status = typeof STATUSES[number]

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req)
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const body = (await req.json()) as Partial<{
      id: string
      status: Status
      trackingNumber: string
      carrier: string
      notes: string
    }>
    const id = String(body?.id || '')
    const status = body?.status
    if (!id || !status || !(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const orderRef = adminDb.collection('orders').doc(id)
    const snap = await orderRef.get()
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const data = snap.data() as { userId?: string | null }
    const patch: PartialWithFieldValue<DocumentData> & UpdateData<DocumentData> = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (typeof body.trackingNumber === 'string') patch.trackingNumber = body.trackingNumber.trim()
    if (typeof body.carrier === 'string') patch.carrier = body.carrier.trim()
    if (typeof body.notes === 'string') patch.notes = body.notes.trim()

    const batch = adminDb.batch()
    batch.update(orderRef, patch)
    const uid = data?.userId
    if (uid) {
      const userOrderRef = adminDb.collection('users').doc(uid).collection('orders').doc(id)
      batch.set(userOrderRef, patch, { merge: true })
    }
    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Update failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}