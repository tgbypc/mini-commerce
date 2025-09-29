'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { toast } from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const normalizedEmail = email.trim()
      const normalizedPassword = password
      if (!normalizedEmail || !normalizedPassword) {
        toast.error('Email and password are required')
        return
      }

      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, normalizedPassword)

      let role: 'admin' | 'user' = 'user'
      try {
        const user = credential.user
        if (user) {
          const snap = await getDoc(doc(db, 'users', user.uid))
          const data = snap.exists() ? (snap.data() as { role?: string }) : null
          if (data?.role === 'admin') {
            role = 'admin'
          } else if (user.email) {
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
              .split(',')
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean)
            if (adminEmails.includes(user.email.toLowerCase())) {
              role = 'admin'
            }
          }
        }
      } catch (err) {
        console.error('Failed to resolve user role after login', err)
      }

      const nextParam = searchParams.get('next')
      const destination = nextParam && nextParam.startsWith('/')
        ? nextParam
        : role === 'admin'
          ? '/admin'
          : '/user/profile'

      toast.success('Logged in successfully')
      router.push(destination)
    } catch (error) {
      const message =
        error instanceof FirebaseError
          ? (() => {
              switch (error.code) {
                case 'auth/invalid-credential':
                case 'auth/wrong-password':
                  return 'Email or password is incorrect'
                case 'auth/user-disabled':
                  return 'Your account has been disabled'
                case 'auth/user-not-found':
                  return 'No user found with this email'
                default:
                  return error.message || 'Failed to log in'
              }
            })()
          : 'Failed to log in'
      toast.error(message)
      console.error('Login failed', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-600">
        Don’t have an account?{' '}
        <a href="/user/register" className="underline">
          Register
        </a>
      </p>
    </div>
  )
}
