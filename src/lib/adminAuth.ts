import { auth, adminDb } from '@/lib/firebaseAdmin'

const IMPERSONATE_COOKIE_NAME = 'mini_admin_impersonate'

function hasImpersonationCookie(req: Request): boolean {
  const header = req.headers.get('cookie')
  if (!header) return false

  const parts = header.split(';')
  for (const rawPart of parts) {
    const part = rawPart.trim()
    if (!part) continue
    const eqIndex = part.indexOf('=')
    if (eqIndex <= 0) continue
    const name = part.slice(0, eqIndex)
    const value = part.slice(eqIndex + 1)
    if (name === IMPERSONATE_COOKIE_NAME && value === '1') {
      return true
    }
  }
  return false
}

export async function requireAdminFromRequest(req: Request): Promise<{ uid: string } | { error: string; status: number }> {
  try {
    if (hasImpersonationCookie(req)) {
      return { uid: 'impersonated' }
    }

    // Allow ADMIN_SECRET for simple setups
    const secret = process.env.ADMIN_SECRET
    if (secret) {
      const h = req.headers.get('x-admin-secret') || req.headers.get('authorization') || ''
      if (h === secret || h === `Bearer ${secret}`) return { uid: 'secret' }
    }

    const h = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    if (!h || !h.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 }
    const token = h.slice(7).trim()
    const decoded = await auth.verifyIdToken(token)
    const uid = decoded.uid
    const snap = await adminDb.collection('users').doc(uid).get()
    const role = (snap.data() as { role?: string } | undefined)?.role || 'user'
    if (role !== 'admin') return { error: 'Forbidden', status: 403 }
    return { uid }
  } catch {
    return { error: 'Unauthorized', status: 401 }
  }
}
