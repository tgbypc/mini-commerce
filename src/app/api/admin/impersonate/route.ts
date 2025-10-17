import { NextRequest, NextResponse } from 'next/server'
import { requireAdminFromRequest } from '@/lib/adminAuth'

const COOKIE_NAME = 'mini_admin_impersonate'
const COOKIE_MAX_AGE_SECONDS = 60 * 30 // 30 minutes

function successResponse() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: COOKIE_NAME,
    value: '1',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
  return res
}

export async function POST(req: NextRequest) {
  let payload: unknown = null
  try {
    payload = await req.json()
  } catch {
    // empty body is fine; continue
  }

  const providedSecret =
    payload &&
    typeof payload === 'object' &&
    payload !== null &&
    'secret' in payload
      ? String((payload as { secret?: string }).secret ?? '')
      : ''

  const adminSecret = process.env.ADMIN_SECRET

  if (providedSecret) {
    if (!adminSecret) {
      return NextResponse.json(
        { ok: false, error: 'Admin secret not configured' },
        { status: 500 }
      )
    }

    if (providedSecret !== adminSecret) {
      return NextResponse.json(
        { ok: false, error: 'Invalid secret' },
        { status: 401 }
      )
    }

    return successResponse()
  }

  const gate = await requireAdminFromRequest(req)
  if ('error' in gate) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: gate.status }
    )
  }

  return successResponse()
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)
  if (!cookie || cookie.value !== '1') {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
