'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>(
    'checking'
  )
  const cookieSynced = useRef(false)

  useEffect(() => {
    if (!user || role !== 'admin' || cookieSynced.current) return
    cookieSynced.current = true
    ;(async () => {
      try {
        const token = await user.getIdToken()
        await fetch('/api/admin/impersonate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ via: 'token-sync' }),
        })
      } catch (err) {
        console.error('AdminOnly: failed to refresh admin cookie', err)
        cookieSynced.current = false
      }
    })()
  }, [user, role])

  useEffect(() => {
    if (loading) return

    if (user && role === 'admin') {
      setStatus('allowed')
      return
    }

    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/admin/impersonate', {
          method: 'GET',
          cache: 'no-store',
        })
        if (!active) return
        setStatus(res.ok ? 'allowed' : 'denied')
      } catch (err) {
        console.error('AdminOnly: impersonation check failed', err)
        if (!active) return
        setStatus('denied')
      }
    })()

    return () => {
      active = false
    }
  }, [loading, user, role])

  useEffect(() => {
    if (loading || status !== 'denied') return
    const target =
      pathname && pathname.startsWith('/')
        ? `/unlock?next=${encodeURIComponent(pathname)}`
        : '/unlock'
    router.replace(target)
  }, [loading, status, pathname, router])

  if (loading || status === 'checking') return null
  if (status !== 'allowed') return null

  return <>{children}</>
}
