'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

export default function CartPage() {
  const { state, total, incr, decr, remove } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { t, locale } = useI18n()

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'nb' ? 'nb-NO' : 'en-US', {
        style: 'currency',
        currency: 'USD',
      }),
    [locale]
  )

  const itemCount = useMemo(
    () => state.items.reduce((acc, item) => acc + item.qty, 0),
    [state.items]
  )
  const itemLabel = useMemo(() => {
    const key = itemCount === 1 ? 'cart.count.one' : 'cart.count.other'
    return t(key).replace('{count}', String(itemCount))
  }, [itemCount, t])
  const subtitle = useMemo(
    () => t('cart.subtitle').replace('{items}', itemLabel),
    [itemLabel, t]
  )
  const summaryProductsLabel = useMemo(
    () => t('cart.summary.products').replace('{items}', itemLabel),
    [itemLabel, t]
  )

  const checkout = async () => {
    try {
      if (!user) {
        toast.error('Please sign in to complete checkout')
        router.push('/user/login?next=/cart')
        return
      }
      setLoading(true)
      type CheckoutBody = {
        items: { productId: string; quantity: number }[]
        uid?: string
        email?: string
        locale?: 'en' | 'nb'
      }
      const payload: CheckoutBody = {
        items: state.items.map((i) => ({
          productId: i.productId,
          quantity: i.qty,
        })),
      }
      if (user?.uid) payload.uid = user.uid
      if (user?.email) payload.email = user.email
      if (locale === 'nb' || locale === 'en') payload.locale = locale

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Checkout failed')
        return
      }
      if (data?.url) {
        window.location.href = data.url
      } else {
        toast.error('No checkout URL')
      }
    } catch (e) {
      console.error(e)
      toast.error('Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  if (state.items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <EmptyState
          title={t('cart.emptyTitle')}
          message={t('cart.emptyMessage')}
          action={
            <Link
              href="/"
              className="inline-flex items-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-900"
            >
              {t('cart.emptyCta')}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {t('cart.title')}
        </h1>
        <p className="text-sm text-zinc-600">{subtitle}</p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-4">
          {state.items.map((it) => {
            const imageSrc = (it.thumbnail ?? '').trim() || '/placeholder.png'
            const unitPrice = Number.isFinite(it.price)
              ? it.price
              : Number(it.price ?? 0)
            const lineTotal = unitPrice * it.qty
            const title = (it.title ?? '').trim() || t('cart.productFallback')
            const imageAlt = t('cart.imageAlt').replace('{product}', title)
            return (
              <div
                key={it.productId}
                className="rounded-3xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur transition hover:shadow-md sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-zinc-100 sm:h-24 sm:w-28 sm:flex-none">
                    <Image
                      src={imageSrc}
                      alt={imageAlt}
                      fill
                      sizes="(max-width: 640px) 100vw, 112px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <Link
                        href={`/products/${it.productId}`}
                        className="text-sm font-semibold text-zinc-900 transition hover:text-black"
                      >
                        {title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span>
                          {t('cart.unitPrice')}: {currency.format(unitPrice)}
                        </span>
                        <span aria-hidden className="hidden sm:inline">
                          •
                        </span>
                        <span>
                          {t('cart.lineTotal')}: {currency.format(lineTotal)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-3 text-sm sm:items-end">
                      <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white shadow-sm">
                        <button
                          type="button"
                          className="h-10 w-10 text-lg font-medium text-zinc-600 transition hover:text-black"
                          aria-label={t('cart.quantity.decrease')}
                          onClick={() => decr(it.productId)}
                        >
                          -
                        </button>
                        <span className="min-w-[3rem] text-center font-medium text-zinc-900">
                          {it.qty}
                        </span>
                        <button
                          type="button"
                          className="h-10 w-10 text-lg font-medium text-zinc-600 transition hover:text-black"
                          aria-label={t('cart.quantity.increase')}
                          onClick={() => incr(it.productId)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(it.productId)}
                        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 transition hover:text-red-500"
                      >
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
                            d="m4 7 1.24 12.15A2 2 0 0 0 7.22 21h9.56a2 2 0 0 0 1.98-1.85L20 7"
                            strokeLinecap="round"
                          />
                          <path d="M10 11v6" strokeLinecap="round" />
                          <path d="M14 11v6" strokeLinecap="round" />
                          <path d="M3 7h18" strokeLinecap="round" />
                          <path
                            d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span>{t('cart.remove')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <aside className="h-fit rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm backdrop-blur lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold text-zinc-900">
            {t('cart.summary.title')}
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between text-zinc-600">
              <span>{summaryProductsLabel}</span>
              <span>{currency.format(total)}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-600">
              <span>{t('cart.summary.shipping')}</span>
              <span className="text-xs uppercase tracking-wide text-emerald-600">
                {t('cart.summary.shippingTbd')}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-dashed border-zinc-200 pt-4">
            <div className="flex items-center justify-between text-base font-semibold text-zinc-900">
              <span>{t('cart.summary.subtotal')}</span>
              <span>{currency.format(total)}</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {t('cart.summary.taxNote')}
            </p>
          </div>
          <button
            onClick={checkout}
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t('cart.checkout.loading') : t('cart.checkout.cta')}
          </button>
        </aside>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-zinc-200 px-4 py-2 font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-black"
        >
          {t('cart.continue')}
        </Link>
        <span className="text-xs text-zinc-500">{t('cart.reminder')}</span>
      </div>
    </div>
  )
}
