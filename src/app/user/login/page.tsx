'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

export default function Page() {
  const router = useRouter()
  const { user, loading, emailLogin, logout } = useAuth()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const p = emailLogin(email, password)
    toast.promise(p, {
      loading: 'Giriş yapılıyor…',
      success: 'Hoş geldin! 🎉',
      error: (err) => `Giriş başarısız: ${(err as Error).message}`,
    })
    try {
      await p
      router.replace('/')
    } catch {}
  }

  if (loading) {
    return <div className="max-w-sm mx-auto p-4">Yükleniyor…</div>
  }

  if (user) {
    return (
      <div className="max-w-sm mx-auto p-4">
        <p className="mb-4">Giriş yapıldı: {user.email ?? 'Guest'}</p>
        <button
          onClick={async () => {
            const p = logout()
            toast.promise(p, {
              loading: 'Çıkış yapılıyor…',
              success: 'Çıkış yapıldı.',
              error: (err) => `Çıkış başarısız: ${(err as Error).message}`,
            })
            await p
            router.refresh()
          }}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-full rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 w-full rounded"
        >
          Login
        </button>
      </form>
    </div>
  )
}
