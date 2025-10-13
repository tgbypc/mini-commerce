'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useI18n } from '@/context/I18nContext'

interface ProductPreview {
  id: string
  title: string
  description?: string | null
  category?: string | null
  price: number
  thumbnail?: string | null
}

interface StoreClientProps {
  initialProducts: ProductPreview[]
  initialLocale: string
}

const categoryCards = [
  { slug: 'beauty', accent: 'from-[#fbe8ff] to-[#f2f8ff]' },
  { slug: 'electronics', accent: 'from-[#e4f6ff] to-[#eef2ff]' },
  { slug: 'home', accent: 'from-[#fff4e5] to-[#f2fbf2]' },
  { slug: 'fashion', accent: 'from-[#fff0f3] to-[#f0f7ff]' },
  { slug: 'wellness', accent: 'from-[#e6fdf5] to-[#edf3ff]' },
  { slug: 'outdoor', accent: 'from-[#f1f8ff] to-[#f7fff1]' },
] as const

const benefits = [
  { key: 'shipping', icon: ShippingIcon },
  { key: 'returns', icon: ReturnsIcon },
  { key: 'support', icon: SupportIcon },
] as const

const testimonials = [{ key: 'amelia' }, { key: 'sverre' }] as const

export default function StoreClient({
  initialProducts,
  initialLocale,
}: StoreClientProps) {
  const { t, locale } = useI18n()
  const [bestSellers, setBestSellers] =
    useState<ProductPreview[]>(initialProducts)
  const [loadingProducts, setLoadingProducts] = useState(
    initialProducts.length === 0
  )
  const [productError, setProductError] = useState<string | null>(null)
  const cancelRef = useRef(false)
  const previousLocale = useRef(initialLocale)

  const languageTag = locale === 'nb' ? 'nb-NO' : 'en-US'
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(languageTag, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }),
    [languageTag]
  )

  useEffect(() => {
    if (previousLocale.current === locale && bestSellers.length > 0) return
    previousLocale.current = locale
    cancelRef.current = false
    ;(async () => {
      setLoadingProducts(true)
      try {
        const params = new URLSearchParams({
          limit: '8',
          sort: 'createdAt-desc',
          locale,
        })
        const res = await fetch(`/api/products?${params.toString()}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`status_${res.status}`)
        const data = (await res.json()) as { items?: ProductPreview[] }
        if (!cancelRef.current) {
          setBestSellers(Array.isArray(data.items) ? data.items : [])
          setProductError(null)
        }
      } catch {
        if (!cancelRef.current) {
          setBestSellers([])
          setProductError('load_failed')
        }
      } finally {
        if (!cancelRef.current) setLoadingProducts(false)
      }
    })()

    return () => {
      cancelRef.current = true
    }
  }, [locale, bestSellers.length])

  const metrics = [
    { label: t('store.metrics.orders'), value: '250K+' },
    { label: t('store.metrics.products'), value: '4.8K' },
    { label: t('store.metrics.delivery'), value: '48h' },
  ]

  return (
    <div className="bg-[#f6f7fb] px-4 py-10 md:py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
        <section className="relative overflow-hidden rounded-4xl border border-zinc-200 bg-white/95 px-6 py-12 shadow-[0_32px_56px_rgba(15,23,42,0.08)] sm:px-10">
          <div
            className="absolute inset-y-0 right-[-20%] hidden w-[40%] rounded-full bg-gradient-to-br from-[#dbe7ff] via-white to-[#f5f3ff] blur-3xl sm:block"
            aria-hidden
          />
          <div className="relative z-[1] grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f6f7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                {t('store.hero.kicker')}
              </span>
              <h1 className="text-3xl font-semibold text-[#0d141c] md:text-4xl">
                {t('store.hero.title')}
              </h1>
              <p className="max-w-2xl text-sm text-zinc-600 md:text-base">
                {t('store.hero.subtitle')}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/#featured" className="btn-primary">
                  {t('store.hero.primaryCta')}
                </Link>
                <Link href="/favorites" className="btn-outline">
                  {t('store.hero.secondaryCta')}
                </Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="surface-card bg-gradient-to-br from-white to-[#eef2ff] px-4 py-5 text-center shadow-[0_18px_36px_rgba(91,91,214,0.15)]"
                >
                  <div className="text-2xl font-semibold text-[#0d141c]">
                    {metric.value}
                  </div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="store-categories" className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="store-categories"
                className="text-2xl font-semibold text-[#0d141c]"
              >
                {t('store.categories.title')}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {t('store.categories.subtitle')}
              </p>
            </div>
            <Link href="/" className="btn-outline">
              {t('store.categories.cta')}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryCards.map((item) => (
              <div
                key={item.slug}
                className="relative overflow-hidden surface-card bg-white/95 p-6 transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(91,91,214,0.18)]"
              >
                <div
                  className={`absolute right-[-20%] top-[-20%] size-40 rounded-full bg-gradient-to-br ${item.accent} blur-3xl`}
                  aria-hidden
                />
                <div className="relative z-[1] flex flex-col gap-3">
                  <span className="inline-flex w-fit items-center rounded-full bg-[var(--color-primary-dark)]/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#0d141c]">
                    {t(`store.categories.list.${item.slug}.label`)}
                  </span>
                  <p className="text-sm text-zinc-600">
                    {t(`store.categories.list.${item.slug}.description`)}
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#4338ca] transition hover:text-[#5b5bd6]"
                  >
                    {t('store.categories.list.cta')}
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="featured"
          aria-labelledby="store-featured"
          className="space-y-6"
        >
          <div className="flex flex-col gap-2">
            <h2
              id="store-featured"
              className="text-2xl font-semibold text-[#0d141c]"
            >
              {t('store.bestSellers.title')}
            </h2>
            <p className="text-sm text-zinc-600">
              {t('store.bestSellers.subtitle')}
            </p>
          </div>
          {loadingProducts ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-64 rounded-3xl border border-[#5b5bd6]/20 bg-white/70 shadow animate-pulse"
                />
              ))}
            </div>
          ) : bestSellers.length === 0 ? (
            <div className="surface-card px-6 py-8 text-sm text-zinc-600">
              {productError
                ? t('store.bestSellers.error')
                : t('store.bestSellers.empty')}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {bestSellers.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group flex h-full flex-col overflow-hidden surface-card transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(91,91,214,0.2)]"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-[#f6f7fb]">
                    {product.thumbnail ? (
                      <Image
                        src={product.thumbnail}
                        alt={product.title}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 280px"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                        {t('store.bestSellers.noImage')}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 px-4 py-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      {product.category
                        ? t(`cat.${product.category}`) ?? product.category
                        : t('store.bestSellers.unknownCategory')}
                    </span>
                    <h3 className="line-clamp-2 text-sm font-semibold text-[#0d141c]">
                      {product.title}
                    </h3>
                    <div className="mt-auto flex items-center justify-between text-sm font-semibold text-[#0d141c]">
                      <span>{currencyFormatter.format(product.price)}</span>
                      <span className="text-xs font-medium text-zinc-500">
                        {t('store.bestSellers.cta')}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section
          id="store-benefits"
          aria-labelledby="store-benefits"
          className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center"
        >
          <div className="space-y-4">
            <h2
              id="store-benefits"
              className="text-2xl font-semibold text-[#0d141c]"
            >
              {t('store.benefits.title')}
            </h2>
            <p className="text-sm text-zinc-600">
              {t('store.benefits.subtitle')}
            </p>
            <Link href="/cart" className="btn-outline">
              {t('store.benefits.cta')}
              <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map(({ key, icon: Icon }) => (
              <div key={key} className="flex gap-3 surface-card px-5 py-4">
                <div className="mt-1 size-10 rounded-full bg-[var(--color-primary-dark)]/10 text-[#0d141c]">
                  <Icon />
                </div>
                <div className="space-y-1 text-sm text-[#0d141c]">
                  <h3 className="font-semibold">
                    {t(`store.benefits.list.${key}.title`)}
                  </h3>
                  <p className="text-zinc-600">
                    {t(`store.benefits.list.${key}.description`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="store-testimonials" className="space-y-6">
          <div className="flex flex-col gap-2">
            <h2
              id="store-testimonials"
              className="text-2xl font-semibold text-[#0d141c]"
            >
              {t('store.reviews.title')}
            </h2>
            <p className="text-sm text-zinc-600">
              {t('store.reviews.subtitle')}
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {testimonials.map((item) => (
              <div
                key={item.key}
                className="flex h-full flex-col justify-between surface-card px-6 py-6"
              >
                <p className="text-base italic text-[#0d141c]">
                  “{t(`store.reviews.items.${item.key}.quote`)}”
                </p>
                <div className="mt-4">
                  <div className="text-sm font-semibold text-[#0d141c]">
                    {t(`store.reviews.items.${item.key}.name`)}
                  </div>
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {t(`store.reviews.items.${item.key}.role`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-4xl border border-zinc-200 bg-[var(--color-primary-dark)] px-6 py-10 text-white shadow-[0_30px_60px_rgba(15,23,42,0.35)] sm:px-10">
          <div
            className="absolute -left-20 top-1/2 size-80 -translate-y-1/2 rounded-full bg-white/15 blur-3xl"
            aria-hidden
          />
          <div className="relative z-[1] flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold md:text-3xl">
                {t('store.cta.title')}
              </h2>
              <p className="text-sm text-white/80 md:text-base">
                {t('store.cta.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/cart" className="btn-muted">
                {t('store.cta.primaryCta')}
              </Link>
              <Link
                href="/user/profile"
                className="btn-muted border border-white/40 bg-transparent px-5 py-2.5"
              >
                {t('store.cta.secondaryCta')}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ShippingIcon() {
  return (
    <svg
      className="size-10 p-2"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 7h10v10H3zm10 0h4l4 4v6h-8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ReturnsIcon() {
  return (
    <svg
      className="size-10 p-2"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 4h9.5a4.5 4.5 0 0 1 0 9H5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 1.5 4 4l4 2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 20H8.5a4.5 4.5 0 0 1 0-9H19"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 22.5 20 20l-4-2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SupportIcon() {
  return (
    <svg
      className="size-10 p-2"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3a9 9 0 0 0-9 9v2a3 3 0 0 0 3 3h1v-8A5 5 0 0 1 12 4h0a5 5 0 0 1 5 5v8h-2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 21a3 3 0 1 1-6 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
