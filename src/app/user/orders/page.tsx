'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Timestamp } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

type OrderItem = {
  description?: string
  title?: string | null
  quantity: number
  amountSubtotal?: number
  amountTotal?: number
  priceId?: string | null
  thumbnail?: string | null
}

type OrderDoc = {
  id: string
  sessionId?: string
  amountTotal?: number | null
  currency?: string | null
  paymentStatus?: string | null
  status?: string | null
  createdAt?:
    | Timestamp
    | Date
    | { seconds?: number; nanoseconds?: number }
    | { _seconds?: number; _nanoseconds?: number }
    | null
  items?: OrderItem[]
}

function resolveDate(createdAt: OrderDoc['createdAt']) {
  if (typeof createdAt === 'string') return new Date(createdAt)
  if (createdAt instanceof Timestamp) return createdAt.toDate()
  if (createdAt instanceof Date) return createdAt
  if (createdAt && typeof createdAt === 'object') {
    const seconds =
      typeof (createdAt as { seconds?: number }).seconds === 'number'
        ? (createdAt as { seconds?: number }).seconds
        : typeof (createdAt as { _seconds?: number })._seconds === 'number'
        ? (createdAt as { _seconds?: number })._seconds
        : undefined
    const nanos =
      typeof (createdAt as { nanoseconds?: number }).nanoseconds === 'number'
        ? (createdAt as { nanoseconds?: number }).nanoseconds
        : typeof (createdAt as { _nanoseconds?: number })._nanoseconds ===
          'number'
        ? (createdAt as { _nanoseconds?: number })._nanoseconds
        : 0
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000 + Math.floor((nanos ?? 0) / 1e6))
    }
  }
  return null
}

export default function OrdersPage() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderDoc[]>([])

  const localeTag = locale === 'nb' ? 'nb-NO' : 'en-US'

  const formatCurrency = useMemo(
    () => (value: number, currency: string | null | undefined) => {
      const safeCurrency = (currency || 'USD').toUpperCase()
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
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [localeTag]
  )

  const statusLabels = useMemo(
    () => ({
      paid: t('orders.orderCard.status.paid'),
      complete: t('orders.orderCard.status.complete'),
      fulfilled: t('orders.orderCard.status.fulfilled'),
      shipped: t('orders.orderCard.status.shipped'),
      delivered: t('orders.orderCard.status.delivered'),
      open: t('orders.orderCard.status.open'),
      canceled: t('orders.orderCard.status.canceled'),
      unpaid: t('orders.orderCard.status.unpaid'),
    }),
    [t]
  )

  const paymentLabels = useMemo(
    () => ({
      paid: t('orders.orderCard.payment.paid'),
      unpaid: t('orders.orderCard.payment.unpaid'),
      refunded: t('orders.orderCard.payment.refunded'),
      no_payment_required: t('orders.orderCard.payment.no_payment_required'),
    }),
    [t]
  )

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setOrders([])
      setLoading(false)
      return
    }

    const fetchOrders = async () => {
      try {
        setLoading(true)
        const token = await user.getIdToken()
        const res = await fetch('/api/user/orders', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to fetch orders')
        const data = (await res.json()) as OrderDoc[]
        setOrders(data)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [user, authLoading])

  if (!user && !authLoading) {
    return (
      <div className="min-h-[60vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-zinc-200 bg-white/90 px-6 py-10 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-[#0d141c]">
            {t('orders.title')}
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
          <div className="h-40 rounded-3xl border border-zinc-200 bg-white/80 shadow animate-pulse" />
          <div className="h-52 rounded-3xl border border-zinc-200 bg-white/75 shadow animate-pulse" />
        </div>
      </div>
    )
  }

  if (!orders.length) {
    return (
      <div className="bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-8 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-[#0d141c]">
              {t('orders.title')}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">{t('orders.empty')}</p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-zinc-200 px-5 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-white"
            >
              {t('fav.continue')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const totalSpent = orders.reduce((sum, o) => {
    const amount =
      typeof o.amountTotal === 'number'
        ? o.amountTotal
        : Number(o.amountTotal ?? 0)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)
  const averageSpent = orders.length > 0 ? totalSpent / orders.length : 0
  const primaryCurrency = (orders[0]?.currency ?? 'USD').toUpperCase()

  const summarySubtitle = t('orders.summary.subtitle')
  const countLabel = t('orders.summary.count').replace(
    '{count}',
    String(orders.length)
  )
  const totalLabelText = t('orders.summary.totalLabel')
  const totalValue = t('orders.summary.totalValue').replace(
    '{amount}',
    formatCurrency(totalSpent, primaryCurrency)
  )
  const averageLabelText = t('orders.summary.averageLabel')
  const averageValue = t('orders.summary.averageValue').replace(
    '{amount}',
    formatCurrency(averageSpent || 0, primaryCurrency)
  )

  const capitalize = (value: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : value

  return (
    <div className="bg-[#f6f7fb] px-4 py-10">
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
          <div className="relative z-[1] flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-[#0d141c]">
                {t('orders.title')}
              </h1>
              <p className="max-w-xl text-sm text-zinc-600">
                {summarySubtitle}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[#0d141c] shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  {t('orders.orderCard.label')}
                </div>
                <div className="mt-1 text-base font-semibold">{countLabel}</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[#0d141c] shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  {totalLabelText}
                </div>
                <div className="mt-1 text-base font-semibold">{totalValue}</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[#0d141c] shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  {averageLabelText}
                </div>
                <div className="mt-1 text-base font-semibold">
                  {averageValue}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          {orders.map((o) => {
            const date = resolveDate(o.createdAt)
            const when = date ? dateFormatter.format(date) : ''
            const count =
              o.items?.reduce((n, it) => {
                const qty = Number(it.quantity ?? 0)
                return n + (Number.isFinite(qty) ? qty : 0)
              }, 0) ?? 0
            const totalMajor = (() => {
              if (typeof o.amountTotal === 'number') return o.amountTotal
              const parsed = Number(o.amountTotal ?? 0)
              return Number.isFinite(parsed) ? parsed : 0
            })()
            const currency = (o.currency ?? 'USD').toUpperCase()
            const status = String(o.status || 'paid').toLowerCase()
            const paymentStatus = String(o.paymentStatus || '').toLowerCase()

            const statusLabel =
              statusLabels[status as keyof typeof statusLabels] ??
              capitalize(status)
            const paymentLabel = paymentStatus
              ? paymentLabels[paymentStatus as keyof typeof paymentLabels] ??
                capitalize(paymentStatus)
              : null
            const orderLabel = `${t('orders.orderCard.label')} #${o.id}`
            const totalLabelCard = t('orders.orderCard.total')
            const itemsLabel = t('orders.orderCard.items').replace(
              '{count}',
              String(count)
            )
            const sessionLabel = t('orders.orderCard.session').replace(
              '{id}',
              o.sessionId || 'N/A'
            )
            const detailLabel = t('orders.orderCard.details')
            const placedLabel = when
              ? t('orders.orderCard.placedOn').replace('{date}', when)
              : ''

            const steps = [
              { key: 'paid', icon: '💳', label: statusLabels.paid },
              { key: 'fulfilled', icon: '📦', label: statusLabels.fulfilled },
              {
                key: 'shipped',
                icon: '🚚',
                label: statusLabels.shipped ?? statusLabels.fulfilled,
              },
              {
                key: 'delivered',
                icon: '🏡',
                label: statusLabels.delivered ?? statusLabels.complete,
              },
            ] as const
            const activeIdx = Math.max(
              0,
              steps.findIndex(
                (step) => step.key === (status as (typeof steps)[number]['key'])
              )
            )
            const totalSegments = Math.max(steps.length - 1, 1)
            const progressPercent = Math.min(
              100,
              Math.max(0, (activeIdx / totalSegments) * 100)
            )

            const previewItems = (o.items ?? []).slice(0, 2)
            const extraCount = Math.max(
              0,
              (o.items?.length ?? 0) - previewItems.length
            )

            return (
              <div
                key={o.id}
                className="rounded-3xl border border-zinc-200 bg-white/95 px-5 py-6 shadow-[0_20px_40px_rgba(15,23,42,0.06)] transition hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)] sm:px-6 md:px-8"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 break-all md:break-normal">
                      {orderLabel}
                    </div>
                    {placedLabel && (
                      <div className="text-sm text-zinc-600">{placedLabel}</div>
                    )}
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M5 12h14" strokeLinecap="round" />
                        <path
                          d="m12 5 7 7-7 7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {statusLabel}
                    </div>
                  </div>
                  <div className="space-y-2 text-left md:text-right">
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                      {totalLabelCard}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[#0d141c]">
                      {formatCurrency(totalMajor, currency)}
                    </div>
                    {paymentLabel && (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <path d="M2 10h20" />
                        </svg>
                        {paymentLabel}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="relative h-1 rounded-full bg-zinc-200">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-400 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                    <span
                      className="absolute top-1/2 flex size-7 -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full bg-white text-lg shadow-[0_6px_16px_rgba(15,23,42,0.12)]"
                      style={{ left: `${progressPercent}%` }}
                    >
                      🚚
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M8 2v3" strokeLinecap="round" />
                        <path d="M16 2v3" strokeLinecap="round" />
                        <rect x="4" y="5" width="16" height="15" rx="2" />
                        <path d="M4 11h16" />
                      </svg>
                      {itemsLabel}
                    </span>
                    <span className="inline-flex max-w-full items-center gap-2 break-all">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M20 4H4v16l5-3 3 3 3-3 5 3z" />
                      </svg>
                      {sessionLabel}
                    </span>
                  </div>
                </div>

                {previewItems.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {previewItems.map((item, idx) => {
                      const label =
                        item.description ||
                        item.title ||
                        t('orderDetail.items.fallback')
                      const quantityLabel = t(
                        'orderDetail.items.quantity'
                      ).replace('{count}', String(item.quantity ?? 0))
                      const thumbnail = item.thumbnail
                      return (
                        <span
                          key={`${label}-${idx}`}
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-[#f6f7fb] px-2.5 py-1 text-xs text-zinc-700"
                        >
                          <span className="relative inline-block h-7 w-7 overflow-hidden rounded-full border border-white shadow-sm">
                            {thumbnail ? (
                              <Image
                                src={thumbnail}
                                alt={label}
                                fill
                                sizes="28px"
                                className="object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center rounded-full bg-[#f4f4f5] text-[10px] text-zinc-500">
                                {idx + 1}
                              </span>
                            )}
                          </span>
                          <span className="font-medium text-[#0d141c] max-w-[130px] truncate">
                            {label}
                          </span>
                          <span className="text-zinc-500">{quantityLabel}</span>
                        </span>
                      )
                    })}
                    {extraCount > 0 && (
                      <span className="inline-flex items-center rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500">
                        +{extraCount}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                  <Link
                    prefetch={false}
                    href={`/user/orders/${o.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      router.push(`/user/orders/${o.id}`)
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-[#0d141c] transition hover:bg-[#f6f7fb] sm:w-auto"
                  >
                    <span>{detailLabel}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="m9 6 6 6-6 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center rounded-full bg-[var(--color-primary-dark)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
          >
            {t('fav.continue')}
          </Link>
        </div>
      </div>
    </div>
  )
}
