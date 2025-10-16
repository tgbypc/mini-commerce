import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { requireAdminFromRequest } from '@/lib/adminAuth'
import { sendEmailViaResend } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ReplyPayload = {
  subject?: string
  message?: string
  note?: string
}

export async function POST(
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

  let payload: ReplyPayload
  try {
    payload = (await req.json()) as ReplyPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const subject = payload.subject?.trim()
  const body = payload.message?.trim()

  if (!subject || !body) {
    return NextResponse.json(
      { error: 'Subject and message are required' },
      { status: 400 }
    )
  }

  try {
    const docRef = adminDb.collection('contactMessages').doc(id)
    const docSnap = await docRef.get()
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const data = docSnap.data() as { email?: string; name?: string }
    const recipient = data.email?.trim()
    if (!recipient) {
      return NextResponse.json(
        { error: 'Message does not include a valid email address' },
        { status: 400 }
      )
    }

    const plainText = body
    const firstLine =
      typeof data.name === 'string' && data.name.trim().length
        ? `Merhaba ${data.name.trim()},`
        : 'Merhaba,'
    const html = `<p>${firstLine}</p><p>${body.replace(/\n/g, '<br />')}</p>`

    await sendEmailViaResend({
      to: recipient,
      subject,
      html,
      text: `${firstLine}\n\n${plainText}`,
    })

    const update: Record<string, unknown> = {
      status: 'responded',
      adminRespondedAt: FieldValue.serverTimestamp(),
      adminRespondedBy: gate.uid,
      adminReadAt: FieldValue.serverTimestamp(),
    }

    if (typeof payload.note === 'string') {
      const trimmed = payload.note.trim()
      if (trimmed) update.adminNote = trimmed
      else update.adminNote = FieldValue.delete()
    }

    await docRef.update(update)
    const latestSnap = await docRef.get()

    return NextResponse.json({
      id: latestSnap.id,
      ...(latestSnap.data() ?? {}),
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to send email reply'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

