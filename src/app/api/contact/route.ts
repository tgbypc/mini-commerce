import { NextResponse } from 'next/server'
import { z } from 'zod'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOPICS = ['general', 'order', 'returns', 'partnership'] as const

const messageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  topic: z.enum(TOPICS),
  message: z.string().trim().min(10).max(2000),
})

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new Error('Invalid JSON payload')
    })
    const data = messageSchema.parse(body)
    const emailLc = data.email.toLowerCase()

    await adminDb.collection('contactMessages').add({
      ...data,
      emailLc,
      status: 'new',
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid form data', details: err.flatten() },
        { status: 400 }
      )
    }
    const message =
      err instanceof Error ? err.message : 'Failed to submit message'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
