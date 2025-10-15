'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/context/I18nContext'

export default function VerifyEmailPage() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<
    'idle' | 'verifying' | 'success' | 'error' | 'expired'
  >('idle')
  const [messageKey, setMessageKey] = useState<
    | 'verifyEmail.success.description'
    | 'verifyEmail.errors.missing'
    | 'verifyEmail.errors.failed'
    | 'verifyEmail.errors.expired'
    | null
  >(null)
  const [messageOverride, setMessageOverride] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessageOverride(null)
      setMessageKey('verifyEmail.errors.missing')
      return
    }

    let cancelled = false
    ;(async () => {
      setStatus('verifying')
      setMessageKey(null)
      setMessageOverride(null)
      try {
        const res = await fetch('/api/auth/email-verification/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = (await res.json()) as { error?: string }
        if (cancelled) return
        if (!res.ok) {
          if (res.status === 410) {
            setStatus('expired')
            setMessageKey('verifyEmail.errors.expired')
            setMessageOverride(null)
          } else {
            setStatus('error')
            setMessageKey('verifyEmail.errors.failed')
            setMessageOverride(data.error ?? null)
          }
          return
        }
        setStatus('success')
        setMessageKey('verifyEmail.success.description')
        setMessageOverride(null)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setStatus('error')
        setMessageKey('verifyEmail.errors.failed')
        setMessageOverride(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  const message =
    messageOverride ?? (messageKey ? t(messageKey) : undefined) ?? ''
  const showResultCard = status !== 'verifying' && status !== 'idle'

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">{t('verifyEmail.title')}</h1>
      {status === 'verifying' && (
        <p className="text-sm text-zinc-600">
          {t('verifyEmail.verifying')}
        </p>
      )}
      {showResultCard && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-700">{message}</p>
          <div className="mt-4 flex items-center gap-3 text-sm">
            <Link
              href="/user/profile"
              className="rounded bg-black px-3 py-2 text-white"
            >
              {t('verifyEmail.actions.profile')}
            </Link>
            <Link href="/" className="rounded border px-3 py-2">
              {t('verifyEmail.actions.home')}
            </Link>
          </div>
        </div>
      )}
      {status === 'success' && (
        <p className="mt-4 text-xs text-zinc-500">
          {t('verifyEmail.successNote')}
        </p>
      )}
    </div>
  )
}
