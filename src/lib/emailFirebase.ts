import { adminDb, FieldValue } from '@/lib/firebaseAdmin'

type QueueArgs = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
}

// Queues an email for Firebase Extensions: Trigger Email
// Requires the extension installed in your Firebase project.
export async function queueEmail({ to, subject, html, text, cc, bcc }: QueueArgs): Promise<{ id: string }> {
  const payload: Record<string, unknown> = {
    to,
    cc,
    bcc,
    message: {
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    },
    createdAt: FieldValue.serverTimestamp(),
  }
  const ref = await adminDb.collection('mail').add(payload)
  return { id: ref.id }
}

