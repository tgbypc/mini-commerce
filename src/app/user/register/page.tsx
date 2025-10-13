'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { toast } from 'react-hot-toast'
import { useI18n } from '@/context/I18nContext'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const normalizedEmail = email.trim()
      const normalizedPassword = password
      if (!normalizedEmail || !normalizedPassword) {
        toast.error('Email and password are required')
        setLoading(false)
        return
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        normalizedPassword
      )
      if (name.trim()) {
        try {
          await updateProfile(cred.user, { displayName: name.trim() })
        } catch {}
      }
      toast.success('Account created')
      try {
        const token = await cred.user.getIdToken()
        const res = await fetch('/api/auth/email-verification/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string
          }
          const message =
            data.error ||
            'Verification email could not be sent. Please try again later.'
          toast.error(message)
        } else {
          toast.success('Verification email sent. Please check your inbox.')
        }
      } catch (verificationError) {
        console.error('Verification email failed', verificationError)
        toast.error(
          'Could not send verification email. Please resend from your profile later.'
        )
      }
      router.push('/user/profile')
    } catch (error) {
      console.error(error)
      toast.error('Failed to register')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (socialLoading) return
    setSocialLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const credential = await signInWithPopup(auth, provider)
      toast.success(t('auth.register.googleSuccess'))
      try {
        const token = await credential.user.getIdToken()
        await fetch('/api/auth/email-verification/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ skipSend: true }),
        }).catch(() => undefined)
      } catch {}
      router.push('/user/profile')
    } catch (error) {
      console.error('Google sign-in failed', error)
      toast.error(t('auth.register.googleError'))
    } finally {
      setSocialLoading(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-10 px-4 py-16 sm:px-6 lg:px-8 lg:py-20 xl:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between rounded-3xl border border-zinc-200/60 bg-white px-8 py-10 text-[#0d141c] shadow-[0_40px_80px_-40px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[rgba(24,32,45,0.75)] dark:text-white/90 dark:shadow-[0_40px_90px_-45px_rgba(13,18,27,0.65)] lg:flex">
        <div className="space-y-6">
          <span className="inline-flex items-center rounded-full border border-fuchsia-100 bg-fuchsia-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-500 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/20 dark:text-fuchsia-200">
            {t('auth.register.kicker')}
          </span>
          <h2 className="text-3xl font-semibold leading-tight">
            {t('auth.register.heroTitle')}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-300/80">
            {t('auth.register.heroSubtitle')}
          </p>
        </div>
        <div className="space-y-4 text-sm text-zinc-500 dark:text-zinc-300/80">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 size-2 rounded-full bg-fuchsia-400"
              aria-hidden
            />
            <span>{t('auth.register.benefits.one')}</span>
          </div>
          <div className="flex items-start gap-3">
            <span
              className="mt-1 size-2 rounded-full bg-fuchsia-400"
              aria-hidden
            />
            <span>{t('auth.register.benefits.two')}</span>
          </div>
          <div className="flex items-start gap-3">
            <span
              className="mt-1 size-2 rounded-full bg-fuchsia-400"
              aria-hidden
            />
            <span>{t('auth.register.benefits.three')}</span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200/60 bg-white/95 p-8 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-[rgba(15,18,28,0.92)] dark:shadow-[0_34px_70px_-45px_rgba(5,7,11,0.6)]">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-semibold text-[#0d141c] dark:text-white">
            {t('auth.register.title')}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-300/80">
            {t('auth.register.subtitle')}
          </p>
        </div>
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
              {t('auth.labels.name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-[#0d141c] shadow-[0_20px_40px_-35px_rgba(15,23,42,0.45)] transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-[rgba(24,28,38,0.9)] dark:text-white dark:shadow-[0_24px_54px_-36px_rgba(2,6,16,0.6)] dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
              placeholder={t('auth.register.placeholders.name')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
              {t('auth.labels.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-[#0d141c] shadow-[0_20px_40px_-35px_rgba(15,23,42,0.45)] transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-[rgba(24,28,38,0.9)] dark:text-white dark:shadow-[0_24px_54px_-36px_rgba(2,6,16,0.6)] dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
              required
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 sm:auto-rows-fr">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                {t('auth.labels.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-[#0d141c] shadow-[0_20px_40px_-35px_rgba(15,23,42,0.45)] transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-[rgba(24,28,38,0.9)] dark:text-white dark:shadow-[0_24px_54px_-36px_rgba(2,6,16,0.6)] dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                {t('auth.labels.confirmPassword')}
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-[#0d141c] shadow-[0_20px_40px_-35px_rgba(15,23,42,0.45)] transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-[rgba(24,28,38,0.9)] dark:text-white dark:shadow-[0_24px_54px_-36px_rgba(2,6,16,0.6)] dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
                required
                minLength={6}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#4f46e5] via-[#7c3aed] to-[#f472b6] px-6 py-3 text-sm font-semibold text-white shadow-[0_26px_60px_-32px_rgba(79,70,229,0.6)] transition hover:-translate-y-0.5 hover:from-[#4338ca] hover:to-[#ec4899] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:shadow-[0_30px_62px_-34px_rgba(236,72,153,0.45)] dark:focus-visible:ring-fuchsia-300/70 dark:focus-visible:ring-offset-[rgba(13,18,28,0.8)]"
          >
            {loading ? t('auth.register.loading') : t('auth.register.cta')}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative my-6 flex items-center">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
            <span className="px-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
              {t('auth.register.divider')}
            </span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={socialLoading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-[#0d141c] shadow-[0_18px_42px_-30px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:bg-[rgba(24,28,38,0.9)] dark:text-white dark:shadow-[0_24px_52px_-32px_rgba(2,6,16,0.6)] dark:hover:border-white/20 dark:hover:bg-[rgba(30,34,46,0.95)] dark:focus-visible:ring-indigo-400/30 dark:focus-visible:ring-offset-[rgba(13,18,28,0.8)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M21.6 12.227c0-.68-.06-1.333-.173-1.96H12v3.708h5.382c-.232 1.25-.937 2.31-1.992 3.022v2.513h3.226c1.89-1.739 2.984-4.3 2.984-7.283Z"
                fill="#4285F4"
              />
              <path
                d="M12 22c2.7 0 4.968-.894 6.624-2.41l-3.226-2.513c-.894.6-2.037.955-3.398.955-2.615 0-4.828-1.765-5.619-4.128H3.06v2.593C4.704 19.983 8.034 22 12 22Z"
                fill="#34A853"
              />
              <path
                d="M6.381 13.904a5.983 5.983 0 0 1 0-3.808V7.503H3.06a9.998 9.998 0 0 0 0 8.994l3.321-2.593Z"
                fill="#FBBC05"
              />
              <path
                d="M12 6.08c1.47 0 2.788.505 3.826 1.5l2.872-2.873C16.963 2.931 14.695 2 12 2 8.034 2 4.704 4.017 3.06 7.503l3.321 2.593C7.172 7.845 9.385 6.08 12 6.08Z"
                fill="#EA4335"
              />
            </svg>
            {socialLoading
              ? t('auth.register.googleLoading')
              : t('auth.register.googleCta')}
          </button>
        </div>

        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-300/80">
          {t('auth.register.footer')}{' '}
          <a
            href="/user/login"
            className="font-medium text-indigo-500 transition hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200"
          >
            {t('auth.register.switchLink')}
          </a>
        </p>
      </div>
    </div>
  )
}
