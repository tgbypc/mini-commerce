'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const DEFAULT_TARGET = '/admin'

export default function AdminSecretForm() {
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, role } = useAuth()

  const nextParam = searchParams.get('next')
  const redirectTarget =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : DEFAULT_TARGET

  const handleSuccess = (feedback: string) => {
    setError(null)
    setMessage(feedback)
    setSecret('')
    setTimeout(() => {
      router.replace(redirectTarget)
    }, 500)
  }

  const submitSecret = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secret.trim()) {
      setError('Please enter the admin secret.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secret.trim() }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Secret verification failed.')
        return
      }
      handleSuccess('Access granted - admin area unlocked.')
    } catch (err) {
      console.error('AdminSecretForm: secret verification failed', err)
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const useExistingSession = async () => {
    if (!user) {
      setError('You need to sign in with Firebase first.')
      return
    }
    if (role !== 'admin') {
      setError('Current Firebase account is not an admin.')
      return
    }

    setSessionLoading(true)
    setError(null)
    setMessage(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ via: 'firebase-session' }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Unable to confirm admin session.')
        return
      }
      handleSuccess('Session confirmed - redirecting to admin panel.')
    } catch (err) {
      console.error('AdminSecretForm: session handshake failed', err)
      setError('Failed to verify Firebase session. Try again.')
    } finally {
      setSessionLoading(false)
    }
  }

  return (
    <div className="space-y-6 rounded-3xl border border-zinc-200/60 bg-white/95 p-8 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-[rgba(15,18,28,0.92)] dark:shadow-[0_34px_70px_-45px_rgba(5,7,11,0.6)]">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[#0d141c] dark:text-white">
          Unlock admin area
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-300/80">
          Use the backup secret or your Firebase admin session to obtain a
          temporary cookie. Secrets never touch the client; everything happens
          server-side.
        </p>
      </div>

      <form onSubmit={submitSecret} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300">
            Admin secret
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter the shared admin backup secret"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-[#0d141c] shadow-[0_20px_40px_-35px_rgba(15,23,42,0.45)] transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-[rgba(24,28,38,0.9)] dark:text-white dark:shadow-[0_24px_54px_-36px_rgba(2,6,16,0.6)] dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-white shadow-[0_24px_48px_-28px_rgba(79,70,229,0.7)] transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Checking...' : 'Unlock admin'}
        </button>
      </form>

      <div className="space-y-3 rounded-2xl border border-dashed border-indigo-200/60 bg-indigo-50/60 p-4 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
        <p className="font-semibold uppercase tracking-[0.22em] text-xs text-indigo-500/80 dark:text-indigo-200/80">
          Already signed in with Firebase?
        </p>
        <p>
          If you logged in with <code>admin@demo.com</code> (or any admin
          account), click the button below to mint the temporary admin cookie
          using your Firebase ID token.
        </p>
        <button
          type="button"
          onClick={useExistingSession}
          disabled={sessionLoading}
          className="inline-flex items-center justify-center rounded-xl border border-indigo-400/30 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600 transition hover:border-indigo-400/60 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-400/40 dark:bg-[rgba(19,26,43,0.9)] dark:text-indigo-200/90 dark:hover:border-indigo-300/60 dark:hover:bg-[rgba(29,38,60,0.9)]"
        >
          {sessionLoading ? 'Verifying...' : 'Use Firebase session'}
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200/90">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-50/80 px-4 py-3 text-sm text-rose-600 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-200/90">
          {error}
        </div>
      )}
    </div>
  )
}
