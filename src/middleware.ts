import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const COOKIE_NAME = 'mini_admin_impersonate'

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const impersonated = req.cookies.get(COOKIE_NAME)?.value === '1'
  if (impersonated) {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = '/unlock'
  url.searchParams.set('next', pathname)

  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/:path*'],
}
