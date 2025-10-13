'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useI18n } from '@/context/I18nContext'
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/constants/categories'

type ListItem = {
  id: string
  title: string
  description?: string
  category?: string
  brand?: string
  price: number
  thumbnail?: string
}

type FetchOptions = {
  cursor?: string | null
  reset?: boolean
  overrideSearch?: string
}

type HomeClientProps = {
  initialItems: ListItem[]
  initialNextCursor: string | null
  initialLocale: string
}

export default function HomeClient({
  initialItems,
  initialNextCursor,
  initialLocale,
}: HomeClientProps) {
  const { t, locale } = useI18n()
  const [items, setItems] = useState<ListItem[]>(initialItems)
  const [loading, setLoading] = useState(initialItems.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<
    'createdAt-desc' | 'price-asc' | 'price-desc' | 'title-asc' | 'title-desc'
  >('createdAt-desc')
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const inFlight = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstFilterRun = useRef(false)
  const firstSearchRun = useRef(false)
  const initialLocaleRef = useRef(initialLocale)

  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const categories = useMemo(() => CATEGORIES as unknown as string[], [])
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'nb' ? 'nb-NO' : 'en-US', {
        style: 'currency',
        currency: 'USD',
      }),
    [locale]
  )

  function resolveMessage(key: string, fallback: string) {
    const value = t(key)
    return value === key ? fallback : value
  }

  const searchPlaceholder = resolveMessage(
    'home.searchPlaceholder',
    'Search products'
  )
  const searchHint = resolveMessage(
    'home.searchHint',
    'Discover products by name, brand or category. Use filters or try a popular search below.'
  )
  const searchCtaLabel = resolveMessage('home.searchCta', 'Search')
  const quickFiltersLabel = resolveMessage(
    'home.quickFilters',
    'Quick filters:'
  )
  const clearLabel = resolveMessage('home.clear', 'Clear')
  const browseCategoriesLabel = resolveMessage(
    'home.browseByCategory',
    'Browse by category'
  )

  async function fetchPage(opts: FetchOptions = {}) {
    if (inFlight.current) return
    inFlight.current = true
    try {
      if (opts.reset) setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (selectedCats.length > 0)
        params.set('categories', selectedCats.join(','))
      params.set('locale', locale)
      const querySource =
        typeof opts.overrideSearch === 'string' ? opts.overrideSearch : search
      const q = querySource.trim()
      if (q) params.set('q', q)
      if (sort) params.set('sort', sort)
      if (opts.cursor) params.set('cursor', opts.cursor)

      const res = await fetch(`/api/products?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`Failed to load products: ${res.status}`)
      const data = (await res.json()) as {
        items: ListItem[]
        nextCursor?: string | null
      }
      let added = 0
      setItems((prev) => {
        const start = opts.reset ? [] : prev
        if (!Array.isArray(data.items) || data.items.length === 0) return start
        const seen = new Set(start.map((i) => String(i.id)))
        const merged: ListItem[] = [...start]
        for (const it of data.items) {
          const key = String(it.id)
          if (seen.has(key)) continue
          seen.add(key)
          merged.push(it)
          added++
        }
        return merged
      })
      setNextCursor(added > 0 ? data.nextCursor ?? null : null)
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load products'
      setError(msg)
      if (opts.reset) setItems([])
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    fetchPage({ reset: true })
  }

  function handleClearSearch() {
    if (!search) return
    setSearch('')
    fetchPage({ reset: true, overrideSearch: '' })
  }

  function toggleCategory(slug: string) {
    setSelectedCats((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  const quickCategories = categories.slice(0, 6)
  const activeCategoryLabels = selectedCats.map(
    (slug) =>
      t(`cat.${slug}`) ||
      CATEGORY_LABELS[slug as (typeof CATEGORIES)[number]] ||
      slug
  )

  useEffect(() => {
    if (initialItems.length === 0) {
      fetchPage({ reset: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (initialLocaleRef.current !== locale) {
      initialLocaleRef.current = locale
      fetchPage({ reset: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  useEffect(() => {
    if (!firstFilterRun.current) {
      firstFilterRun.current = true
      return
    }
    fetchPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCats.join(','), sort])

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (!firstSearchRun.current) {
      firstSearchRun.current = true
      return
    }
    debounceTimer.current = setTimeout(() => {
      fetchPage({ reset: true })
    }, 350)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div className="px-4 py-5 md:px-40">
      <div className="mx-auto w-full max-w-[960px]">
        <div className="px-0 py-6 md:px-4">
          <div className="relative overflow-hidden surface-card bg-white/95 backdrop-blur">
            <div
              className="absolute inset-y-0 right-[-30%] w-2/3 rounded-full bg-gradient-to-br from-[#e7edf4] via-white to-[#f5f5f5] blur-3xl"
              aria-hidden
            />
            <div className="relative z-[1] grid gap-6 p-6 md:p-10">
              <div className="space-y-2">
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
                  {resolveMessage('home.featured', 'Featured')}
                </span>
                <h1 className="text-2xl font-semibold text-[#0d141c] tracking-tight md:text-3xl">
                  {searchPlaceholder}
                </h1>
                <p className="max-w-xl text-sm text-zinc-600 md:text-base">
                  {searchHint}
                </p>
              </div>

              <form
                onSubmit={handleSearchSubmit}
                role="search"
                className="w-full"
              >
                <div className="relative flex items-center rounded-2xl border border-[#5b5bd6]/30 bg-white shadow-sm transition focus-within:border-[#5b5bd6] focus-within:shadow-[0_16px_32px_rgba(91,91,214,0.16)]">
                  <span className="pointer-events-none pl-4 text-zinc-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="22"
                      height="22"
                      fill="currentColor"
                      viewBox="0 0 256 256"
                    >
                      <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                    </svg>
                  </span>
                  <input
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-14 w-full flex-1 border-none bg-transparent px-4 text-base text-[#0d141c] placeholder:text-zinc-400 focus:outline-none"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700"
                      aria-label={clearLabel}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M18 6 6 18"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="m6 6 12 12"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  )}
                  <button type="submit" className="mr-3 btn-primary">
                    {searchCtaLabel}
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <span className="font-medium text-[#0d141c]">
                  {quickFiltersLabel}
                </span>
                {quickCategories.map((slug) => {
                  const label =
                    t(`cat.${slug}`) ||
                    CATEGORY_LABELS[slug as (typeof CATEGORIES)[number]] ||
                    slug
                  const active = selectedCats.includes(slug)
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleCategory(slug)}
                      className={`chip-soft text-xs font-semibold ${
                        active
                          ? 'border-transparent bg-gradient-to-r from-[#5b5bd6] to-[#7c3aed] text-white shadow-[0_8px_20px_rgba(91,91,214,0.25)]'
                          : ''
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
                {selectedCats.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCats([])}
                    className="btn-outline px-3 py-1 text-xs"
                  >
                    {clearLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {activeCategoryLabels.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span className="font-medium text-[#0d141c]">
              {browseCategoriesLabel}
            </span>
            {activeCategoryLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-[#0d141c]"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
          <div>
            {t('home.activeFilters')}{' '}
            <span className="font-semibold text-[#0d141c]">
              {selectedCats.length || search
                ? `${selectedCats.length + (search ? 1 : 0)}`
                : t('home.all')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="home-sort"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500"
            >
              {t('home.sortLabel')}
            </label>
            <select
              id="home-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-[#0d141c] focus:border-[#0d141c] focus:outline-none"
            >
              <option value="createdAt-desc">{t('home.sort.newest')}</option>
              <option value="price-asc">{t('home.sort.priceAsc')}</option>
              <option value="price-desc">{t('home.sort.priceDesc')}</option>
              <option value="title-asc">{t('home.sort.titleAsc')}</option>
              <option value="title-desc">{t('home.sort.titleDesc')}</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-72 rounded-3xl border border-zinc-200 bg-white/80 shadow animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white/95 px-6 py-8 text-center text-sm text-zinc-600">
            {t('home.noResults')}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/products/${item.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/95 shadow transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)]"
              >
                <div className="relative h-44 w-full overflow-hidden bg-[#f6f7fb]">
                  {item.thumbnail ? (
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
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
                    {item.category
                      ? t(`cat.${item.category}`) ?? item.category
                      : t('store.bestSellers.unknownCategory')}
                  </span>
                  <h3 className="line-clamp-2 text-sm font-semibold text-[#0d141c]">
                    {item.title}
                  </h3>
                  <div className="mt-auto flex items-center justify-between text-sm font-semibold text-[#0d141c]">
                    <span>{currencyFormatter.format(item.price)}</span>
                    <span className="text-xs font-medium text-zinc-500">
                      {t('store.bestSellers.cta')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {nextCursor && !loading && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => fetchPage({ cursor: nextCursor })}
              className="btn-outline"
            >
              {t('home.loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
