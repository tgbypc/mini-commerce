import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = ['new', 'read', 'responded', 'archived'] as const

type UpdatePayload = {
  status?: string | null
  adminNote?: string | null
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminFromRequest(req)
  if ('error' in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { id: rawId } = await params
  const id = rawId?.trim()
  if (!id) {
    return NextResponse.json({ error: 'Missing message id' }, { status: 400 })
  }

  let payload: UpdatePayload
  try {
    payload = (await req.json()) as UpdatePayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  const status = (payload.status || '').trim().toLowerCase()
  if (status) {
    if (!(ALLOWED_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = status
    if (status === 'responded') {
      updates.adminRespondedAt = FieldValue.serverTimestamp()
      updates.adminRespondedBy = gate.uid
    }
    if (status === 'read') {
      updates.adminReadAt = FieldValue.serverTimestamp()
    }
  }

  if (typeof payload.adminNote === 'string') {
    const note = payload.adminNote.trim()
    updates.adminNote = note
    if (!note) {
      updates.adminNote = FieldValue.delete()
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json(
      { error: 'No updates provided' },
      { status: 400 }
    )
  }

  try {
    const ref = adminDb.collection('contactMessages').doc(id)
    await ref.update(updates)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json(
        { error: 'Message not found after update' },
        { status: 404 }
      )
    }
    return NextResponse.json({ id: snap.id, ...(snap.data() ?? {}) })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update message'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
