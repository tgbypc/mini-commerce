import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireAdminFromRequest } from '@/lib/adminAuth'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const gate = await requireAdminFromRequest(req)
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const form = await req.formData()
    const file = form.get('file')

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided (field name must be "file")' }, { status: 400 })
    }

    if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File is too large (max 5MB)' }, { status: 413 })
    }

    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
    }

    const ext = (file.type?.split('/')[1] ?? 'bin').toLowerCase()
    const name = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { url } = await put(name, file, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
      token: process.env.BLOB_READ_WRITE_TOKEN, // explicit token for local dev
    })

    return NextResponse.json({ url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    console.error('[upload] error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
