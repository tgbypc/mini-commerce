import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided (field name must be "file")' }, { status: 400 })
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