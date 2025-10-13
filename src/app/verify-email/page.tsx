'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<
    'idle' | 'verifying' | 'success' | 'error' | 'expired'
  >('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Doğrulama bağlantısı eksik veya hatalı.')
      return
    }

    let cancelled = false
    ;(async () => {
      setStatus('verifying')
      try {
        const res = await fetch('/api/auth/email-verification/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = (await res.json()) as { error?: string }
        if (cancelled) return
        if (!res.ok) {
          setStatus(res.status === 410 ? 'expired' : 'error')
          setMessage(data.error || 'Doğrulama işlemi başarısız oldu.')
          return
        }
        setStatus('success')
        setMessage(
          'E-posta adresiniz başarıyla doğrulandı. Artık hesabınıza güvenle devam edebilirsiniz.'
        )
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setStatus('error')
        setMessage(
          'Doğrulama sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">E-posta Doğrulama</h1>
      {status === 'verifying' && (
        <p className="text-sm text-zinc-600">
          Bağlantınız doğrulanıyor, lütfen bekleyin…
        </p>
      )}
      {status !== 'verifying' && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-700">{message}</p>
          <div className="mt-4 flex items-center gap-3 text-sm">
            <Link
              href="/user/profile"
              className="rounded bg-black px-3 py-2 text-white"
            >
              Profilime dön
            </Link>
            <Link href="/" className="rounded border px-3 py-2">
              Ana sayfaya git
            </Link>
          </div>
        </div>
      )}
      {status === 'success' && (
        <p className="mt-4 text-xs text-zinc-500">
          Profil sayfasında “Email verified” rozetini göremiyorsanız sayfayı
          yenileyin.
        </p>
      )}
    </div>
  )
}
