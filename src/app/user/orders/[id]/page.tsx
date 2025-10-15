'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Timestamp } from 'firebase/firestore'
import { useParams } from 'next/navigation'
import { fmtCurrency } from '@/lib/money'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { formatOrderReference } from '@/lib/orderReference'

function resolveDate(value: OrderDetail['createdAt']) {
  if (typeof value === 'string') return new Date(value)
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  if (value && typeof value === 'object') {
    const seconds =
      typeof (value as { seconds?: number }).seconds === 'number'
        ? (value as { seconds?: number }).seconds
        : typeof (value as { _seconds?: number })._seconds === 'number'
        ? (value as { _seconds?: number })._seconds
        : undefined
    const nanos =
      typeof (value as { nanoseconds?: number }).nanoseconds === 'number'
        ? (value as { nanoseconds?: number }).nanoseconds
        : typeof (value as { _nanoseconds?: number })._nanoseconds === 'number'
        ? (value as { _nanoseconds?: number })._nanoseconds
        : 0
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000 + Math.floor((nanos ?? 0) / 1e6))
    }
  }
  return null
}

type LineItem = {
  productId: string | null
  description?: string | null
  title?: string | null
  quantity: number
  unitAmount: number | null
  currency: string
  thumbnail?: string | null
}

type ShippingAddress = {
  line1?: string | null
  line2?: string | null
  postal_code?: string | null
  city?: string | null
  town?: string | null
  state?: string | null
  country?: string | null
}

type ShippingInfo = {
  method?: string | null
  amountTotal?: number | null
  address?: ShippingAddress | null
  name?: string | null
} | null

type OrderDetail = {
  id: string
  sessionId?: string
  amountTotal?: number | null
  currency?: string | null
  paymentStatus?: string | null
  status?: 'paid' | 'fulfilled' | 'shipped' | 'delivered' | 'canceled'
  shipping?: ShippingInfo
  createdAt?: Timestamp | Date | null
  items?: LineItem[]
}

export default function OrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string

  const { user, loading: authLoading } = useAuth()
  const { t, locale } = useI18n()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<OrderDetail | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (authLoading || !user || !orderId) return
      try {
        setLoading(true)
        const token = await user.getIdToken()
        const res = await fetch(
          `/api/user/orders/${encodeURIComponent(orderId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )
        if (!res.ok) throw new Error('Order fetch failed')
        const data = (await res.json()) as OrderDetail
        if (!cancelled) setOrder(data)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, orderId])

  const localeTag = locale === 'nb' ? 'nb-NO' : 'en-US'

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [localeTag]
  )

  const dateInfo = useMemo(() => {
    if (!order) return { when: '', iso: '', date: null as Date | null }
    const date = resolveDate(order.createdAt)
    return {
      date,
      when: date ? dateFormatter.format(date) : '',
      iso: date ? date.toISOString() : '',
    }
  }, [order, dateFormatter])

  if (!user && !authLoading) {
    return (
      <div className="min-h-[60vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-zinc-200 bg-white/90 px-6 py-10 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-[#0d141c]">
            {t('orderDetail.title')}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {t('orders.loginPrompt')}
          </p>
          <Link
            href="/user/login"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--color-primary-dark)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
          >
            {t('nav.login')}
          </Link>
        </div>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-[40vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto grid w-full max-w-5xl gap-6">
          <div className="h-48 rounded-3xl border border-zinc-200 bg-white/80 shadow animate-pulse" />
          <div className="h-72 rounded-3xl border border-zinc-200 bg-white/75 shadow animate-pulse" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-[40vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-zinc-200 bg-white/90 px-6 py-10 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-[#0d141c]">
            {t('orderDetail.title')}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">{t('orders.empty')}</p>
          <Link
            href="/user/orders"
            className="mt-6 inline-flex items-center justify-center rounded-full border border-zinc-200 px-5 py-2 text-sm font_medium text-[#0d141c] transition hover:bg-white"
          >
            {t('orderDetail.back')}
          </Link>
        </div>
      </div>
    )
  }

  const rawOrderId = order.id || order.sessionId || ''
  const orderReference = formatOrderReference(rawOrderId)
  const referenceText = orderReference
    ? t('orderDetail.referenceLabel').replace('{id}', orderReference)
    : t('orderDetail.referenceFallback')
  const referenceBadge = orderReference ?? t('orderDetail.referenceFallback')

  const currency = (order.currency ?? 'USD').toUpperCase()
  const steps: Array<{
    key: NonNullable<OrderDetail['status']>
    label: string
    icon: string
  }> = [
    { key: 'paid', label: t('orderDetail.status.paid'), icon: '💳' },
    { key: 'fulfilled', label: t('orderDetail.status.fulfilled'), icon: '📦' },
    { key: 'shipped', label: t('orderDetail.status.shipped'), icon: '🚚' },
    { key: 'delivered', label: t('orderDetail.status.delivered'), icon: '🏡' },
  ]
  const statusKey = (order.status || 'paid') as (typeof steps)[number]['key']
  const activeIdx = steps.findIndex((s) => s.key === statusKey)

  const subtotal = (order.items || []).reduce(
    (sum, item) =>
      sum + Number(item.unitAmount ?? 0) * Number(item.quantity ?? 0),
    0
  )
  const shipping = order.shipping?.amountTotal || 0
  const shippingMethod = order.shipping?.method || 'Standard'

  const formatMoney = (amount: number | null | undefined) =>
    fmtCurrency(amount ?? 0, currency, localeTag)

  const subtotalDisplay = formatMoney(subtotal)
  const shippingDisplay = formatMoney(shipping)
  const totalDisplay = formatMoney(order.amountTotal ?? 0)

  const addressLines = (() => {
    const addr = order.shipping?.address
    if (!addr) return [] as string[]
    const lines: string[] = []
    if (addr.line1) lines.push(addr.line1)
    if (addr.line2) lines.push(addr.line2)
    const cityLine = [addr.postal_code, addr.city || addr.town, addr.state]
      .filter(Boolean)
      .join(' ')
    if (cityLine) lines.push(cityLine)
    if (addr.country) lines.push(addr.country)
    return lines
  })()

  return (
    <div className="bg-[#f6f7fb] px-4 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/95 px-6 py-8 shadow-[0_24px_48px_rgba(15,23,42,0.08)] md:px-10">
          <div
            className="absolute left-6 top-6 size-20 rounded-full bg-gradient-to-br from-[#dbeafe] to-[#f5f3ff] blur-3xl"
            aria-hidden
          />
          <div
            className="absolute -right-12 bottom-0 h-36 w-36 rounded-full bg-gradient-to-br from-[#f1f5f9] to-white blur-2xl"
            aria-hidden
          />
          <div className="relative z-[1] flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f4f4f5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-600">
                {referenceBadge}
              </div>
              <h1 className="text-2xl font-semibold text-[#0d141c]">
                {t('orderDetail.title')}
              </h1>
              {dateInfo.when && (
                <p className="text-sm text-zinc-600">
                  {t('orderDetail.placedOn').replace('{date}', dateInfo.when)}
                </p>
              )}
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-zinc-600 md:items-end">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-[#0d141c]">
                {totalDisplay}
              </span>
              <span className="text-xs text-zinc-500">{referenceText}</span>
              <Link
                href="/user/orders"
                className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary-dark)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
              >
                {t('orderDetail.back')}
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/95 px-6 py-6 shadow-[0_20px_40px_rgba(15,23,42,0.06)] md:px-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-600">
            {t('orderDetail.status.heading')}
          </h2>

          <div className="relative mt-6">
            <div className="h-1 w-full rounded-full bg-zinc-200" />
            <div
              className="absolute top-0 h-1 rounded-full bg-emerald-400 transition-all"
              style={{
                width: `${
                  Math.max(0, activeIdx / Math.max(steps.length - 1, 1)) * 100
                }%`,
              }}
            />
            <span
              className="absolute -top-3 flex size-7 -translate-x-1/2 items-center justify-center rounded-full bg-white text-lg shadow-[0_6px_16px_rgba(15,23,42,0.12)]"
              style={{
                left: `${
                  Math.max(0, activeIdx / Math.max(steps.length - 1, 1)) * 100
                }%`,
              }}
            >
              🚚
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {steps.map((step, index) => {
              const state =
                index < activeIdx
                  ? 'done'
                  : index === activeIdx
                  ? 'current'
                  : 'todo'
              const circleTone =
                state === 'done'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : state === 'current'
                  ? 'bg-[var(--color-primary-dark)] text-white border-[#0d141c]'
                  : 'bg-white text-zinc-400 border-zinc-200'
              const labelTone =
                state === 'current'
                  ? 'text-[#0d141c] font-semibold'
                  : state === 'done'
                  ? 'text-emerald-700'
                  : 'text-zinc-500'
              const hintTone =
                state === 'done'
                  ? 'text-emerald-600'
                  : state === 'current'
                  ? 'text-[#0d141c]'
                  : 'text-zinc-400'
              const hintLabel =
                state === 'current'
                  ? t('orderDetail.status.current')
                  : state === 'done'
                  ? t('orderDetail.status.completed')
                  : t('orderDetail.status.upcoming')

              return (
                <div
                  key={step.key}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <span
                    className={`flex size-10 items-center justify-center rounded-full border transition-all ${circleTone}`}
                  >
                    {step.icon}
                  </span>
                  <span className={`text-sm transition-colors ${labelTone}`}>
                    {step.label}
                  </span>
                  <span
                    className={`text-xs font-semibold uppercase tracking-[0.2em] ${hintTone}`}
                  >
                    {hintLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-zinc-200 bg-white/95 px-6 py-6 shadow-[0_20px_40px_rgba(15,23,42,0.06)] md:px-10">
            <h2 className="text-lg font-semibold text-[#0d141c]">
              {t('orderDetail.items.heading')}
            </h2>
            {order.items && order.items.length ? (
              <ul className="mt-4 divide-y divide-zinc-200">
                {order.items.map((item, index) => {
                  const label =
                    item.description ||
                    item.title ||
                    t('orderDetail.items.fallback')
                  const quantityLabel = t('orderDetail.items.quantity').replace(
                    '{count}',
                    String(item.quantity ?? 0)
                  )
                  return (
                    <li
                      key={`${label}-${index}`}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        {item.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.thumbnail}
                            alt={label}
                            className="size-14 rounded-2xl border border-zinc-200 object-cover"
                          />
                        ) : (
                          <div className="size-14 rounded-2xl border border-dashed border-zinc-200 bg-[#f6f7fb]" />
                        )}
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-[#0d141c]">
                            {label}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {quantityLabel}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-[#0d141c]">
                        {formatMoney(
                          (item.unitAmount ?? 0) * (item.quantity ?? 0)
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-zinc-600">
                {t('success.items.empty')}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-zinc-200 bg-white/95 px-6 py-6 shadow-[0_20px_40px_rgba(15,23,42,0.06)] md:px-10">
              <h2 className="text-lg font-semibold text-[#0d141c]">
                {t('orderDetail.payment.heading')}
              </h2>
              <div className="mt-4 space-y-2 text-sm text-[#0d141c]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">
                    {t('orderDetail.payment.subtotal')}
                  </span>
                  <span className="font-medium">{subtotalDisplay}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">
                    {t('orderDetail.payment.shipping').replace(
                      '{method}',
                      shippingMethod
                    )}
                  </span>
                  <span className="font-medium">{shippingDisplay}</span>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-zinc-200 pt-2 text-base font-semibold">
                  <span>{t('orderDetail.payment.total')}</span>
                  <span>{totalDisplay}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white/95 px-6 py-6 shadow-[0_20px_40px_rgba(15,23,42,0.06)] md:px-10">
              <h2 className="text-lg font-semibold text-[#0d141c]">
                {t('orderDetail.shipping.heading')}
              </h2>
              {addressLines.length ? (
                <div className="mt-3 space-y-1 text-sm text-zinc-600">
                  {order.shipping?.name && (
                    <div className="font-medium text-[#0d141c]">
                      {order.shipping.name}
                    </div>
                  )}
                  <div>
                    {t('orderDetail.shipping.method')}: {shippingMethod}
                  </div>
                  <div className="pt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {t('orderDetail.shipping.address')}
                  </div>
                  {addressLines.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-600">
                  {t('orderDetail.shipping.missing')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
