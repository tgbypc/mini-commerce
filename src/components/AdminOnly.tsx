'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user || role !== 'admin') router.replace('/')
  }, [user, role, loading, router])

  if (loading || !user || role !== 'admin') {
    return <div className="p-6">Yükleniyor…</div>
  }
  return <>{children}</>
}
