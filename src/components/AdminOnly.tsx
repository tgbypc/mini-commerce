/*, role*/
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || role !== 'admin')) {
      router.replace('/user/login?next=/admin')
    }
  }, [loading, user, role, router])

  // loading bitmeden veya yetki yokken içerik göstermiyoruz
  if (loading || !user || role !== 'admin') return null
  return <>{children}</>
}
