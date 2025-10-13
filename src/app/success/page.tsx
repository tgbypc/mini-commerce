'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { db } from '@/lib/firebase'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { useCart } from '@/context/CartContext'

type SummaryItem = { name: string; qty: number }

export default function SuccessPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const sessionId = useMemo(() => sp.get('id') ?? '', [sp])

  const { t, locale } = useI18n()
  const { clear, reloadFromStorage } = useCart()
  const { user, loading: authLoading } = useAuth()

  const [orderDocId, setOrderDocId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<SummaryItem[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)
  const [customerEmail, setCustomerEmail] = useState<string | null>(null)

  const ran = useRef(false)
  const inFlight = useRef(false)

  const localeTag = locale === 'nb' ? 'nb-NO' : 'en-US'

  const formatCurrency = useMemo(
    () => (value: number, curr: string | null | undefined) => {
      const safeCurrency = (curr || 'USD').toUpperCase()
      const amount = Number.isFinite(value) ? value : 0
      return new Intl.NumberFormat(localeTag, {
        style: 'currency',
        currency: safeCurrency,
      }).format(amount)
    },
    [localeTag]
  )

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    [localeTag]
  )

  const statusLabels = useMemo(
    () => ({
      paid: t('success.status.paid'),
      complete: t('success.status.complete'),
      fulfilled: t('success.status.fulfilled'),
      open: t('success.status.open'),
      canceled: t('success.status.canceled'),
      unpaid: t('success.status.unpaid'),
      default: t('success.status.default'),
    }),
    [t]
  )

  const paymentLabels = useMemo(
    () => ({
      card: t('success.paymentMethods.card'),
      klarna: t('success.paymentMethods.klarna'),
      paypal: t('success.paymentMethods.paypal'),
      default: t('success.paymentMethods.default'),
    }),
    [t]
  )

  const eta = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return dateFormatter.format(d)
  }, [dateFormatter])

  const capitalize = (value: string | null | undefined) => {
    if (!value) return ''
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  const orderReference = useMemo(() => {
    if (!orderDocId) {
      return t('success.summary.pendingReference')
    }
    const normalized = orderDocId.replace(/[^0-9A-Za-z]/g, '')
    const source = normalized.length > 0 ? normalized : orderDocId
    const suffix = source.slice(-6).toUpperCase()
    return `#${suffix}`
  }, [orderDocId, t])

  useEffect(() => {
    if (!sessionId) {
      router.replace('/')
      return
    }
    if (authLoading) return
    if (ran.current || inFlight.current) return
    ran.current = true
    inFlight.current = true

    let cancelled = false
    const ac = new AbortController()

    async function run() {
      try {
        // Fetch Stripe session details for UI
        const res = await fetch(
          `/api/admin/session/${encodeURIComponent(sessionId)}`,
          { cache: 'no-store', signal: ac.signal }
        )
        if (res.ok) {
          const data = await res.json()
          const s = data?.session as {
            amount_total?: number | null
            currency?: string | null
            payment_status?: string | null
            payment_method_types?: string[] | null
            customer_details?: { email?: string | null } | null
            line_items?: {
              data: Array<{
                description?: string | null
                quantity?: number | null
                price?: { product?: { name?: string | null } | null } | null
              }>
            }
          }
          const isPaid = (s?.payment_status ?? 'paid') === 'paid'

          const li = (s?.line_items?.data ?? []).map((row) => ({
            name:
              (row?.description && row.description.trim().length
                ? row.description
                : row?.price?.product?.name) || 'Product',
            qty: row?.quantity ?? 1,
          }))

          if (!cancelled) {
            setItems(li)
            setTotal(
              typeof s?.amount_total === 'number' ? s.amount_total : null
            )
            setCurrency((s?.currency ?? 'usd').toUpperCase())
            setPaymentStatus(
              typeof s?.payment_status === 'string' ? s.payment_status : null
            )
            const method = Array.isArray(s?.payment_method_types)
              ? s?.payment_method_types[0]
              : undefined
            setPaymentMethod(method ?? null)
            const email = s?.customer_details?.email
            setCustomerEmail(typeof email === 'string' ? email : null)
          }

          if (isPaid) {
            // Clear cart once
            try {
              clear()
            } catch {}
            try {
              reloadFromStorage()
            } catch {}
          }
        }

        // Ensure order is written (fallback if webhook didn't run)
        if (!cancelled && user) {
          const pickDocId = (docs: QueryDocumentSnapshot<DocumentData>[]) => {
            if (!docs.length) return null
            const sessionMatch = docs.find((d) => d.id === sessionId)
            if (sessionMatch) return sessionMatch.id
            const fieldMatch = docs.find((d) => {
              const sid = d.data()?.sessionId
              return typeof sid === 'string' && sid.trim() === sessionId
            })
            return (fieldMatch ?? docs[0])?.id ?? null
          }
          try {
            const ref = collection(db, 'users', user.uid, 'orders')
            const q = query(ref, where('sessionId', '==', sessionId), limit(1))
            const snap = await getDocs(q)
            if (!cancelled && !snap.empty) {
              const id = pickDocId(snap.docs)
              if (id) setOrderDocId(id)
            } else {
              const token = await user.getIdToken()
              const ensureRes = await fetch('/api/user/orders/ensure', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ id: sessionId }),
              })
              if (ensureRes.ok) {
                // Try query again
                const snap2 = await getDocs(q)
                if (!cancelled && !snap2.empty) {
                  const id = pickDocId(snap2.docs)
                  if (id) setOrderDocId(id)
                  else setOrderDocId(sessionId)
                } else if (!cancelled) {
                  setOrderDocId(sessionId)
                }
              } else if (!cancelled) {
                setOrderDocId((prev) => prev ?? sessionId)
              }
            }
          } catch {}
        }
      } finally {
        inFlight.current = false
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
      ac.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, authLoading, user])

  if (loading) {
    return (
      <div className="bg-[#f6f7fb] px-4 py-14">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <div className="h-16 rounded-3xl border border-zinc-200 bg-white/80 shadow animate-pulse" />
          <div className="h-64 rounded-3xl border border-zinc-200 bg-white/70 shadow animate-pulse" />
        </div>
      </div>
    )
  }

  const totalFormatted =
    total != null ? formatCurrency(total / 100, currency) : null
  const deliveryValue = t('success.summary.deliveryValue').replace(
    '{date}',
    eta
  )
  const paymentStatusKey = paymentStatus?.toLowerCase() ?? ''
  const paymentStatusLabel = paymentStatusKey
    ? statusLabels[paymentStatusKey as keyof typeof statusLabels] ??
      statusLabels.default
    : statusLabels.default
  const paymentMethodKey = paymentMethod?.toLowerCase() ?? ''
  const paymentMethodLabel =
    paymentLabels[paymentMethodKey as keyof typeof paymentLabels] ||
    (paymentMethod ? capitalize(paymentMethod) : paymentLabels.default)
  const statusTone = (() => {
    if (
      paymentStatusKey === 'paid' ||
      paymentStatusKey === 'fulfilled' ||
      paymentStatusKey === 'complete'
    ) {
      return 'border border-emerald-200 bg-emerald-50 text-emerald-700'
    }
    if (paymentStatusKey === 'canceled') {
      return 'border border-rose-200 bg-rose-50 text-rose-700'
    }
    if (paymentStatusKey === 'unpaid') {
      return 'border border-amber-200 bg-amber-50 text-amber-700'
    }
    return 'border border-sky-200 bg-sky-50 text-sky-700'
  })()
  const quantityLabel = (count: number) =>
    t('success.items.quantity').replace('{count}', String(count))
  const productFallback = t('success.items.fallback')
  const receiptMessage = t('success.next.receipt').replace(
    '{email}',
    customerEmail ?? t('success.next.emailFallback')
  )

  return (
    <div className="bg-[#f6f7fb] px-4 py-14">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/95 px-6 py-10 text-center shadow-[0_24px_48px_rgba(15,23,42,0.08)] md:px-12">
          <div
            className="absolute left-8 top-6 size-24 rounded-full bg-gradient-to-br from-[#dcfce7] to-[#f0f9ff] blur-3xl"
            aria-hidden
          />
          <div
            className="absolute -right-14 bottom-0 h-36 w-36 rounded-full bg-gradient-to-br from-[#e2e8f0] to-white blur-2xl"
            aria-hidden
          />
          <div className="relative z-[1] flex flex-col items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M5 12.5 9.5 17 19 7.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-[#0d141c]">
                {t('success.title')}
              </h1>
              <p className="text-sm text-zinc-600">{t('success.subtitle')}</p>
              <p className="text-xs text-zinc-500">
                {t('success.celebration')}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${statusTone}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M5 12.5 9.5 17 19 7.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {paymentStatusLabel}
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
          <div className="grid gap-4 border-b border-zinc-100 px-6 py-6 md:grid-cols-4">
            <div className="rounded-2xl bg-[#f6f7fb] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                {t('success.summary.orderNumber')}
              </div>
              <div className="mt-2 truncate text-sm font-semibold text-[#0d141c]">
                {orderReference}
              </div>
            </div>
            <div className="rounded-2xl bg-[#f6f7fb] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                {t('success.summary.delivery')}
              </div>
              <div className="mt-2 text-sm font-semibold text-[#0d141c]">
                {deliveryValue}
              </div>
            </div>
            <div className="rounded-2xl bg-[#f6f7fb] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                {t('success.summary.paymentMethod')}
              </div>
              <div className="mt-2 text-sm font-semibold text-[#0d141c]">
                {paymentMethodLabel}
              </div>
            </div>
            <div className="rounded-2xl bg-[#f6f7fb] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                {t('success.summary.paymentStatus')}
              </div>
              <div className="mt-2 text-sm font-semibold text-[#0d141c]">
                {paymentStatusLabel}
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {t('success.items.title')}
            </h2>
            {items.length ? (
              <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-[#f6f7fb]">
                {items.map((it, i) => {
                  const label =
                    it.name && it.name.trim().length ? it.name : productFallback
                  return (
                    <li
                      key={`${label}-${i}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-[#0d141c]"
                    >
                      <span className="flex-1 truncate font-medium">
                        {label}
                      </span>
                      <span className="text-xs font-semibold text-zinc-600">
                        {quantityLabel(it.qty)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                {t('success.items.empty')}
              </p>
            )}

            {totalFormatted && (
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                <span className="text-sm font-medium text-zinc-600">
                  {t('success.total.label')}
                </span>
                <span className="text-base font-semibold text-[#0d141c]">
                  {totalFormatted}
                </span>
              </div>
            )}

            <div className="mt-6 grid gap-3 rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600">
              <div className="flex items-center gap-2 text-[#0d141c]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M12 19v-6" strokeLinecap="round" />
                  <circle cx="12" cy="8" r="1" fill="currentColor" />
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
                </svg>
                <span className="font-semibold">{t('success.next.title')}</span>
              </div>
              <ul className="grid gap-2 text-sm text-zinc-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-emerald-500" />
                  <span>{t('success.next.shipping')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-emerald-500" />
                  <span>{receiptMessage}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-100 px-6 py-6 md:flex-row md:justify-end">
            <Link
              href={orderDocId ? `/user/orders/${orderDocId}` : '/user/orders'}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-[#f6f7fb]"
            >
              {t('success.actions.view')}
            </Link>
            <Link
              href="/user/profile"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-[#f6f7fb]"
            >
              {t('success.actions.profile')}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary-dark)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
            >
              {t('success.actions.continue')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
