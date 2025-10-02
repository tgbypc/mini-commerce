'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useI18n } from '@/context/I18nContext'
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/constants/categories'
import Link from 'next/link'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

type ListItem = {
  id: string
  title: string
  description?: string
  category?: string
  brand?: string
  price: number
  thumbnail?: string
}

export default function HomePage() {
  const { t, locale } = useI18n()
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'createdAt-desc' | 'price-asc' | 'price-desc' | 'title-asc' | 'title-desc'>('createdAt-desc')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const inFlight = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Multi-select categories; empty = all
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const categories = useMemo(() => CATEGORIES as unknown as string[], [])

  function resolveMessage(key: string, fallback: string) {
    const value = t(key)
    return value === key ? fallback : value
  }

  const searchPlaceholder = resolveMessage('home.searchPlaceholder', 'Search products')
  const searchHint = resolveMessage(
    'home.searchHint',
    'Discover products by name, brand or category. Use filters or try a popular search below.'
  )
  const searchCtaLabel = resolveMessage('home.searchCta', 'Search')
  const quickFiltersLabel = resolveMessage('home.quickFilters', 'Quick filters:')
  const clearLabel = resolveMessage('home.clear', 'Clear')
  const browseCategoriesLabel = resolveMessage('home.browseByCategory', 'Browse by category')

  async function fetchPage(opts: { cursor?: string | null; reset?: boolean; overrideSearch?: string }) {
    if (inFlight.current) return
    inFlight.current = true
    try {
      if (opts.reset) setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (selectedCats.length > 0) params.set('categories', selectedCats.join(','))
      params.set('locale', locale)
      const qSource = typeof opts.overrideSearch === 'string' ? opts.overrideSearch : search
      const q = qSource.trim()
      if (q) params.set('q', q)
      if (sort) params.set('sort', sort)
      if (opts.cursor) params.set('cursor', opts.cursor)

      const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load products: ${res.status}`)
      const data = (await res.json()) as { items: ListItem[]; nextCursor?: string | null }
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
      setNextCursor(added > 0 ? (data.nextCursor ?? null) : null)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load products'
      setError(msg)
      if (opts.reset) setItems([])
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
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
  const activeCategoryLabels = selectedCats.map((slug) => (
    t(`cat.${slug}`) || CATEGORY_LABELS[slug as typeof CATEGORIES[number]] || slug
  ))

  // İlk yükleme ve kategori/sort/locale değişiminde ilk sayfayı getir
  useEffect(() => {
    fetchPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCats.join(','), sort, locale])

  // Aramayı küçük bir gecikme ile tetikle (debounce)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      fetchPage({ reset: true })
    }, 350)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div className="px-4 md:px-40 py-5">
      <div className="mx-auto w-full max-w-[960px]">
        {/* Arama + Kategori pill'leri */}
        <div className="px-0 md:px-4 py-6">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/90 shadow-[0_24px_48px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="absolute inset-y-0 right-[-30%] w-2/3 rounded-full bg-gradient-to-br from-[#e7edf4] via-white to-[#f5f5f5] blur-3xl" aria-hidden />
            <div className="relative z-[1] grid gap-6 p-6 md:p-10">
              <div className="space-y-2">
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
                  {resolveMessage('home.featured', 'Featured')}
                </span>
                <h1 className="text-2xl md:text-3xl font-semibold text-[#0d141c] tracking-tight">
                  {searchPlaceholder}
                </h1>
                <p className="text-sm md:text-base text-zinc-600 max-w-xl">
                  {searchHint}
                </p>
              </div>

              <form onSubmit={handleSearchSubmit} role="search" className="w-full">
                <div className="relative flex items-center rounded-2xl border border-zinc-200 bg-white shadow-sm transition focus-within:border-[#0d141c] focus-within:shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M18 6 6 18" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="m6 6 12 12" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="submit"
                    className="mr-3 inline-flex items-center rounded-xl bg-[#0d141c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2a37]"
                  >
                    {searchCtaLabel}
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <span className="font-medium text-zinc-600">{quickFiltersLabel}</span>
                {quickCategories.map((slug) => {
                  const label = (t(`cat.${slug}`) || CATEGORY_LABELS[slug as typeof CATEGORIES[number]] || slug)
                  const active = selectedCats.includes(slug)
                  return (
                    <button
                      key={`quick-${slug}`}
                      type="button"
                      onClick={() => toggleCategory(slug)}
                      className={
                        'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition ' +
                        (active
                          ? 'border border-[#0d141c] bg-[#0d141c] text-white shadow-sm'
                          : 'border border-transparent bg-[#f4f4f5] text-[#0d141c] hover:border-[#0d141c] hover:bg-white')
                      }
                    >
                      {label}
                    </button>
                  )
                })}
                {selectedCats.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCats([])}
                    className="inline-flex items-center rounded-full border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-[#0d141c] shadow-sm transition hover:border-[#0d141c]"
                  >
                    {clearLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-zinc-700 tracking-wide uppercase">
              {browseCategoriesLabel}
            </h4>
            {selectedCats.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCats([])}
                className="text-xs font-medium text-[#0d141c] hover:underline"
              >
                {clearLabel}
              </button>
            )}
          </div>
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex gap-2 pb-2">
              {categories.map((slug) => {
                const active = selectedCats.includes(slug)
                const label = (t(`cat.${slug}`) || CATEGORY_LABELS[slug as typeof CATEGORIES[number]] || slug)
                return (
                  <button
                    key={`cat-${slug}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleCategory(slug)}
                    className={
                      'inline-flex min-w-[120px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition ' +
                      (active
                        ? 'bg-[#0d141c] text-white shadow-sm'
                        : 'bg-[#f4f4f5] text-[#0d141c] hover:bg-white hover:shadow-sm')
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Öne Çıkan Ürünler */}
        <h3 className="text-[#0d141c] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">
          {t('home.featured')}
        </h3>
        {loading && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl bg-slate-100 aspect-square"
              />
            ))}
          </div>
        )}
        {error && !loading && (
          <div className="px-4 py-2 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
            {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="px-4 py-2 text-sm text-zinc-600">
            {t('home.noResults')}
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 p-4">
            {items.slice(0, 4).map((p) => (
              <Link
                key={`feat-${p.id}`}
                href={`/products/${p.id}`}
                className="flex flex-col gap-3 pb-3 transition hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#cedbe8] rounded-xl"
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100">
                  <Image
                    src={(p.thumbnail ?? '').trim() || '/placeholder.png'}
                    alt={p.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                  />
                </div>
                <div className="px-2">
                  <p className="text-[#0d141c] text-base font-medium leading-normal">
                    {p.title}
                  </p>
                  <p className="text-[#49739c] text-sm leading-normal line-clamp-2">
                    {(p.description || '').slice(0, 64)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Tüm Ürünler */}
        <h3 className="text-[#0d141c] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">
          {t('home.all')}
        </h3>
        <div className="px-4 pb-4">
          <div className="mx-auto flex w-full max-w-[960px] flex-wrap items-center gap-3 rounded-3xl border border-zinc-200 bg-white/85 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur md:px-5">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-600">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#f4f4f5] text-[#0d141c]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="m3 5 6.7 9.38v4.62l4.6 2.3v-6.92L21 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>{t('home.sortLabel') ?? 'Sort products'}</span>
            </div>

            <div className="relative min-w-[200px] flex-1 md:flex-none md:min-w-[220px]">
              <select
                value={sort}
                onChange={(e) =>
                  setSort(
                    e.target
                      .value as 'createdAt-desc' | 'price-asc' | 'price-desc' | 'title-asc' | 'title-desc'
                  )
                }
                className="h-11 w-full appearance-none rounded-2xl border border-zinc-200 bg-[#f4f4f5] px-4 pr-9 text-sm font-medium text-[#0d141c] transition focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
              >
                <option value="createdAt-desc">{t('home.sort.newest')}</option>
                <option value="price-asc">{t('home.sort.priceAsc')}</option>
                <option value="price-desc">{t('home.sort.priceDesc')}</option>
                <option value="title-asc">{t('home.sort.titleAsc')}</option>
                <option value="title-desc">{t('home.sort.titleDesc')}</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="m7 9 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>

            {activeCategoryLabels.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm basis-full md:basis-auto">
                <span className="text-zinc-500">{t('home.activeFilters') ?? 'Active filters:'}</span>
                {selectedCats.map((slug) => {
                  const label =
                    t(`cat.${slug}`) || CATEGORY_LABELS[slug as typeof CATEGORIES[number]] || slug
                  return (
                    <button
                      key={`active-${slug}`}
                      type="button"
                      onClick={() => toggleCategory(slug)}
                      className="inline-flex items-center gap-1 rounded-full border border-transparent bg-[#f4f4f5] px-3 py-1 text-sm font-medium text-[#0d141c] transition hover:border-[#0d141c] hover:bg-white"
                    >
                      {label}
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M18 6 6 18" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="m6 6 12 12" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setSelectedCats([])}
                  className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-[#0d141c] transition hover:bg-[#f4f4f5]"
                >
                  {clearLabel}
                </button>
              </div>
            )}

            {nextCursor && (
              <div className="flex items-center justify-end gap-3 basis-full md:basis-auto">
                <button
                  type="button"
                  onClick={() => fetchPage({ cursor: nextCursor })}
                  className="inline-flex items-center rounded-full bg-[#0d141c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2a37] disabled:opacity-60"
                  disabled={inFlight.current}
                >
                  {inFlight.current ? 'Loading…' : t('home.loadMore')}
                </button>
              </div>
            )}
          </div>
        </div>

        {!loading && !error && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 p-4">
            {items.map((p) => (
              <Link
                key={`grid-${p.id}`}
                href={`/products/${p.id}`}
                className="flex flex-col gap-3 pb-3 transition hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#cedbe8] rounded-xl"
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100">
                  <Image
                    src={(p.thumbnail ?? '').trim() || '/placeholder.png'}
                    alt={p.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                  />
                </div>
                <div className="px-2">
                  <p className="text-[#0d141c] text-base font-medium leading-normal">
                    {p.title}
                  </p>
                  <p className="text-[15px] font-semibold text-[#0d141c]">
                    {currency.format(Number(p.price) || 0)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
