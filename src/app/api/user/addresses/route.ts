import { NextResponse } from 'next/server'
import { adminDb, auth, FieldValue } from '@/lib/firebaseAdmin'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tokenFrom(req: Request) {
  const h = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  if (h?.startsWith('Bearer ')) return h.slice(7).trim()
  if (h) return h.trim()
  return null
}

const addressSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s-]{6,20}$/u, 'Invalid phone number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  line1: z.string().trim().min(1).max(120),
  line2: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  city: z.string().trim().min(1).max(80),
  state: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  zip: z.string().trim().min(2).max(20),
  country: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .refine((val) => val.length === 2, 'Country must be ISO alpha-2'),
  isDefault: z.boolean().optional().default(false),
})

export async function GET(req: Request) {
  try {
    const t = tokenFrom(req)
    if (!t) return NextResponse.json({ items: [] })
    const d = await auth.verifyIdToken(t)
    const uid = d.uid
    const snap = await adminDb.collection('users').doc(uid).collection('addresses').orderBy('createdAt', 'desc').get()
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: Request) {
  try {
    const t = tokenFrom(req)
    if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const d = await auth.verifyIdToken(t)
    const uid = d.uid
    const json = await req.json().catch(() => null)
    const parsed = addressSchema.safeParse(json)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue?.message || 'Invalid address payload' },
        { status: 400 },
      )
    }

    const { id, name, phone, line1, line2, city, state, zip, country, isDefault } = parsed.data
    const doc = {
      name,
      phone: phone ?? null,
      line1,
      line2: line2 ?? null,
      city,
      state: state ?? null,
      zip,
      country,
      isDefault,
      updatedAt: FieldValue.serverTimestamp(),
    }
    const col = adminDb.collection('users').doc(uid).collection('addresses')
    const ref = id ? col.doc(id) : col.doc()

    const batch = adminDb.batch()
    if (!id) {
      batch.set(ref, { ...doc, createdAt: FieldValue.serverTimestamp() })
    } else {
      batch.set(ref, doc, { merge: true })
    }
    if (doc.isDefault) {
      const all = await col.get()
      for (const d of all.docs) {
        if (d.id !== ref.id && d.get('isDefault') === true) {
          batch.update(d.ref, { isDefault: false, updatedAt: FieldValue.serverTimestamp() })
        }
      }
    }
    await batch.commit()
    return NextResponse.json({ id: ref.id, ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
