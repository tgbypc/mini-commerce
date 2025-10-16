'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react'
import Link from 'next/link'
import Image from 'next/image'
import clsx from 'clsx'
import { toast } from 'react-hot-toast'
import {
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  PackageSearch,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { Product } from '@/types/product'
import { getAllProducts } from '@/lib/products'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'

type FilterKey = 'all' | 'low-stock' | 'missing-en' | 'missing-nb'

const FILTER_OPTIONS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All products' },
  { key: 'low-stock', label: 'Low stock' },
  { key: 'missing-en', label: 'Missing EN' },
  { key: 'missing-nb', label: 'Missing NB' },
]

function normalizeImageSrc(input: string): string {
  try {
    const u = new URL(input)
    if (u.hostname === 'unsplash.com' && u.pathname.startsWith('/photos/')) {
      const id = u.pathname.split('/')[2] ?? ''
      return `https://source.unsplash.com/${id}/1200x900`
    }
    return input
  } catch {
    return input
  }
}

export default function AdminProducts() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [syncing, setSyncing] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillingNb, setBackfillingNb] = useState(false)
  const [backfillingLC, setBackfillingLC] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [i18nMap, setI18nMap] = useState<
    Record<string, { en: boolean; nb: boolean }>
  >({})

  const lowStockCount = useMemo(() => {
    return items.reduce((acc, product) => {
      const stock =
        typeof product.stock === 'number' && Number.isFinite(product.stock)
          ? product.stock
          : 0
      return stock > 0 && stock <= 5 ? acc + 1 : acc
    }, 0)
  }, [items])

  const missingEnCount = useMemo(() => {
    return items.reduce((acc, product) => {
      const id = String(product.id ?? '')
      return !i18nMap[id]?.en ? acc + 1 : acc
    }, 0)
  }, [items, i18nMap])

  const missingNbCount = useMemo(() => {
    return items.reduce((acc, product) => {
      const id = String(product.id ?? '')
      return !i18nMap[id]?.nb ? acc + 1 : acc
    }, 0)
  }, [items, i18nMap])

  const totalProducts = items.length

  const heroMetrics = useMemo(
    () => [
      { label: 'Products', value: totalProducts },
      { label: 'Low stock', value: lowStockCount },
      { label: 'Missing EN', value: missingEnCount },
      { label: 'Missing NB', value: missingNbCount },
    ],
    [lowStockCount, missingEnCount, missingNbCount, totalProducts]
  )

  const handleLoadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await getAllProducts()
      setItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    const toastId = toast.loading('Refreshing catalog…')
    try {
      await handleLoadProducts()
      toast.success('Catalog updated', { id: toastId })
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to refresh catalog',
        { id: toastId }
      )
    } finally {
      setRefreshing(false)
    }
  }, [handleLoadProducts, refreshing])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const list = await getAllProducts()
        if (!alive) return
        setItems(list)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Failed to load products')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!items.length) return
        const token = await user?.getIdToken().catch(() => undefined)
        const res = await fetch('/api/admin/products/i18n-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ids: items.map((p) => String(p.id)) }),
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          items?: { id: string; en: boolean; nb: boolean }[]
        }
        if (!alive) return
        const map: Record<string, { en: boolean; nb: boolean }> = {}
        for (const row of data.items || []) {
          map[row.id] = { en: row.en, nb: row.nb }
        }
        setI18nMap(map)
      } catch {
        /* no-op */
      }
    })()
    return () => {
      alive = false
    }
  }, [items, user])

  const filteredItems = useMemo(() => {
    const searchValue = query.trim().toLowerCase()
    return items.filter((product) => {
      const id = String(product.id ?? '')
      const stock =
        typeof product.stock === 'number' && Number.isFinite(product.stock)
          ? product.stock
          : 0
      const translation = i18nMap[id]
      const matchesQuery =
        !searchValue ||
        [
          product.title,
          product.title_en,
          product.title_nb,
          product.category,
          product.brand,
        ]
          .map((value) => (value || '').toLowerCase())
          .some((value) => value.includes(searchValue))

      if (!matchesQuery) return false

      switch (filter) {
        case 'low-stock':
          return stock > 0 && stock <= 5
        case 'missing-en':
          return !(translation?.en ?? false)
        case 'missing-nb':
          return !(translation?.nb ?? false)
        default:
          return true
      }
    })
  }, [filter, i18nMap, items, query])

  const formatPrice = useCallback((price: number | string | undefined) => {
    const value = typeof price === 'number' ? price : Number(price) || 0
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(value)
    } catch {
      return `$${value.toFixed(2)}`
    }
  }, [])

  const handleSyncStripe = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    const toastId = toast.loading('Syncing Stripe products…')
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      if (!token) {
        throw new Error('Admin authentication failed')
      }
      const res = await fetch('/api/admin/stripe/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data: unknown = await res.json()
      if (!res.ok) {
        const message =
          (typeof data === 'object' &&
          data &&
          'error' in data &&
          typeof (data as { error: unknown }).error === 'string'
            ? (data as { error: string }).error
            : 'Stripe sync failed') || 'Stripe sync failed'
        throw new Error(message)
      }

      let summary = 'Stripe sync completed.'
      if (typeof data === 'object' && data) {
        const obj = data as Record<string, unknown>
        const processed =
          typeof obj.processed === 'number' ? obj.processed : undefined
        const skipped =
          typeof obj.skipped === 'number' ? obj.skipped : undefined
        const errorsArray = Array.isArray(obj.errors)
          ? (obj.errors as unknown[])
          : null
        summary = `Processed ${processed ?? '-'} • Skipped ${
          skipped ?? '-'
        } • Errors ${errorsArray?.length ?? 0}`
      }

      await handleLoadProducts()
      toast.success(summary, { id: toastId })
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to sync Stripe IDs',
        { id: toastId }
      )
    } finally {
      setSyncing(false)
    }
  }, [handleLoadProducts, syncing, user])

  const handleBackfill = useCallback(async () => {
    if (backfilling) return
    setBackfilling(true)
    const toastId = toast.loading('Backfilling English content…')
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      const res = await fetch(
        '/api/admin/products/backfill-i18n?mode=copy-base-to-en',
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )
      const data = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
        const message =
          (typeof data.error === 'string' && data.error) ||
          'Backfill request failed'
        throw new Error(message)
      }
      await handleLoadProducts()
      toast.success(
        `Updated ${data?.updated ?? '-'} of ${data?.processed ?? '-'}`,
        { id: toastId }
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backfill request failed', {
        id: toastId,
      })
    } finally {
      setBackfilling(false)
    }
  }, [backfilling, handleLoadProducts, user])

  const handleBackfillNb = useCallback(async () => {
    if (backfillingNb) return
    setBackfillingNb(true)
    const toastId = toast.loading('Copying English → Norwegian…')
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      const res = await fetch(
        '/api/admin/products/backfill-i18n?mode=copy-en-to-nb',
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )
      const data = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
        const message =
          (typeof data.error === 'string' && data.error) ||
          'Backfill request failed'
        throw new Error(message)
      }
      await handleLoadProducts()
      toast.success(
        `Updated ${data?.updated ?? '-'} of ${data?.processed ?? '-'}`,
        { id: toastId }
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backfill request failed', {
        id: toastId,
      })
    } finally {
      setBackfillingNb(false)
    }
  }, [backfillingNb, handleLoadProducts, user])

  const handleBackfillTitleLC = useCallback(async () => {
    if (backfillingLC) return
    setBackfillingLC(true)
    const toastId = toast.loading('Backfilling search fields…')
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      const res = await fetch('/api/admin/products/backfill-titlelc', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
        const message =
          (typeof data.error === 'string' && data.error) ||
          'Backfill request failed'
        throw new Error(message)
      }
      await handleLoadProducts()
      toast.success(
        `Updated ${data?.updated ?? '-'} of ${data?.total ?? '-'}`,
        { id: toastId }
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backfill request failed', {
        id: toastId,
      })
    } finally {
      setBackfillingLC(false)
    }
  }, [backfillingLC, handleLoadProducts, user])

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  const heroSurfaceClass =
    'rounded-4xl border border-zinc-200 bg-white/95 shadow-[0_32px_56px_-30px_rgba(15,23,42,0.28)] dark:border-zinc-700 dark:bg-[#111827]'
  const surfaceCardClass =
    'w-full rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_26px_52px_-32px_rgba(15,23,42,0.22)] transition-transform duration-200 backdrop-blur dark:border-zinc-700 dark:bg-[#0f172a]/80'
  const primaryButtonClass =
    'btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60'
  const outlineButtonClass =
    'btn-outline gap-2 disabled:cursor-not-allowed disabled:opacity-60'
  const secondaryActionClass =
    'inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#4338ca] transition hover:-translate-y-0.5 hover:border-[#4338ca]/40 hover:bg-[#4338ca]/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-100 dark:hover:border-[#6366f1]/45 dark:hover:bg-[#4338ca]/20'
  const cardActionClass =
    'inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#0d141c] transition hover:-translate-y-0.5 hover:border-[#4338ca]/35 hover:bg-[#4338ca]/10 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-100 dark:hover:border-[#6366f1]/45 dark:hover:bg-[#4338ca]/20'
  const deleteActionClass =
    'inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-rose-600 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-400/60 dark:hover:bg-rose-500/20'

  return (
    <div className="relative overflow-hidden bg-[#f6f7fb] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <span
        className="pointer-events-none absolute -left-[18%] top-16 size-[320px] rounded-full bg-[rgba(124,58,237,0.14)] blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-10 right-[-22%] size-[360px] rounded-full bg-[rgba(59,130,246,0.12)] blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 text-[#0d141c] dark:text-white">
        <section
          className={`relative overflow-hidden ${heroSurfaceClass} px-6 py-12 sm:px-10`}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-[-22%] hidden w-[52%] rounded-full bg-gradient-to-br from-[#dbe7ff] via-transparent to-transparent blur-3xl sm:block"
            aria-hidden
          />
          <div className="relative z-[1] grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f6f7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:border-zinc-700 dark:bg-[#101828] dark:text-zinc-400">
                Catalog studio
              </span>
              <h1 className="text-3xl font-semibold md:text-4xl">
                Refine your product lineup
              </h1>
              <p className="max-w-2xl text-sm text-zinc-600 md:text-base dark:text-zinc-300">
                Monitor stock, translations, and pricing in a workspace styled
                after the admin messages experience.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/admin/product/new" className={primaryButtonClass}>
                  + {t('admin.add')}
                </Link>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={outlineButtonClass}
                >
                  {refreshing ? (
                    <>
                      <Loader2
                        className="size-4 animate-spin"
                        strokeWidth={1.75}
                      />
                      Refreshing…
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="size-4" strokeWidth={1.75} />
                      Refresh catalog
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-3xl border border-zinc-200 bg-white/90 px-4 py-5 text-center shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] dark:border-zinc-700 dark:bg-[#0b1220]/90"
                >
                  <div className="text-2xl font-semibold text-[#0d141c] dark:text-white">
                    {metric.value.toString().padStart(2, '0')}
                  </div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className={`${surfaceCardClass} flex flex-col gap-5 px-6 py-6`}>
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                Search catalog
              </span>
              <label className="relative flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm transition focus-within:border-[#4338ca] focus-within:ring-2 focus-within:ring-[#4338ca]/20 dark:border-zinc-700 dark:bg-[#0f172a] dark:text-zinc-100">
                <Search className="size-4 text-[#4338ca]" strokeWidth={1.75} />
                <input
                  value={query}
                  onChange={handleSearchChange}
                  placeholder="Search by name, brand, category, SKU…"
                  className="w-full bg-transparent text-sm text-[#0d141c] placeholder:text-zinc-500 focus:outline-none dark:text-zinc-100"
                />
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Showing {filteredItems.length} of {totalProducts} products.
              </p>
            </div>
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                Filters
              </span>
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((option) => {
                  const isActive = filter === option.key
                  const badge =
                    option.key === 'low-stock'
                      ? lowStockCount
                      : option.key === 'missing-en'
                      ? missingEnCount
                      : option.key === 'missing-nb'
                      ? missingNbCount
                      : null
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFilter(option.key)}
                      className={clsx(
                        'rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] transition',
                        isActive
                          ? 'border-[#4338ca] bg-[#4338ca]/15 text-[#4338ca] shadow-[0_8px_22px_-16px_rgba(67,56,202,0.45)]'
                          : 'border-zinc-200 bg-white/85 text-zinc-600 hover:border-[#4338ca]/40 hover:bg-[#4338ca]/10 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-300 dark:hover:border-[#6366f1]/45 dark:hover:bg-[#4338ca]/20'
                      )}
                    >
                      {option.label}
                      {badge && badge > 0 ? (
                        <span className="ml-2 rounded-full bg-[#4338ca]/15 px-2 py-0.5 text-[10px] font-semibold text-[#4338ca] dark:bg-[#4338ca]/25 dark:text-zinc-100">
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className={`${surfaceCardClass} flex flex-col gap-4 px-6 py-6`}>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
              Operations toolkit
            </span>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Keep localization and search data aligned without leaving this
              dashboard.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSyncStripe}
                disabled={syncing}
                className={secondaryActionClass}
              >
                {syncing ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      strokeWidth={1.75}
                    />
                    {t('admin.saving')}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" strokeWidth={1.75} />
                    {t('admin.syncStripe')}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleBackfill}
                disabled={backfilling}
                className={secondaryActionClass}
                title="Copy base content into English locales where missing"
              >
                {backfilling ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      strokeWidth={1.75}
                    />
                    {t('admin.saving')}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" strokeWidth={1.75} />
                    {t('admin.backfillEn')}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleBackfillNb}
                disabled={backfillingNb}
                className={secondaryActionClass}
                title="Copy English localization into Norwegian where missing"
              >
                {backfillingNb ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      strokeWidth={1.75}
                    />
                    {t('admin.saving')}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" strokeWidth={1.75} />
                    Copy EN → NB
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleBackfillTitleLC}
                disabled={backfillingLC}
                className={secondaryActionClass}
                title="Populate lowercase search variants for all locales"
              >
                {backfillingLC ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      strokeWidth={1.75}
                    />
                    {t('admin.saving')}
                  </>
                ) : (
                  <>
                    <PackageSearch className="size-4" strokeWidth={1.75} />
                    Backfill search
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div
            className={`${surfaceCardClass} flex items-center justify-center gap-3 rounded-4xl p-12 text-zinc-600 dark:text-zinc-300`}
          >
            <Loader2 className="size-5 animate-spin" strokeWidth={1.75} />
            Loading products…
          </div>
        ) : error ? (
          <div className="rounded-4xl border border-rose-200 bg-rose-50 p-8 text-rose-600 shadow-[0_26px_52px_-32px_rgba(244,63,94,0.25)] dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            className={`${surfaceCardClass} flex flex-col items-center justify-center gap-4 rounded-4xl p-16 text-center text-zinc-600 dark:text-zinc-300`}
          >
            <PackageSearch
              className="size-12 text-zinc-400"
              strokeWidth={1.75}
            />
            <div>
              <h3 className="text-lg font-semibold text-[#0d141c] dark:text-white">
                No products match this view
              </h3>
              <p className="mt-1 text-sm">
                Adjust your filters or search query to see catalog results.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((product) => {
              const id = String(product.id ?? '')
              const translation = i18nMap[id]
              const primaryImage =
                product.thumbnail ||
                (Array.isArray((product as { images?: string[] }).images)
                  ? (product as { images?: string[] }).images?.[0]
                  : undefined)
              const price = formatPrice(product.price)
              const stock =
                typeof product.stock === 'number' &&
                Number.isFinite(product.stock)
                  ? product.stock
                  : 0
              return (
                <div
                  key={id}
                  className={clsx(
                    surfaceCardClass,
                    'group flex h-full flex-col overflow-hidden px-4 pb-5 pt-4 hover:-translate-y-1'
                  )}
                >
                  <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-[#0f172a]">
                    {primaryImage ? (
                      <Image
                        src={normalizeImageSrc(String(primaryImage))}
                        alt={product.title || 'Product image'}
                        width={640}
                        height={420}
                        className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-52 w-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                        No image
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2">
                      <Badge tone={translation?.en ? 'success' : 'muted'}>
                        EN
                      </Badge>
                      <Badge tone={translation?.nb ? 'success' : 'muted'}>
                        NB
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate text-base font-semibold text-[#0d141c] dark:text-white">
                          {product.title || 'Untitled product'}
                        </h3>
                        <p className="truncate text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                          {(product.brand || '—').toUpperCase()} •{' '}
                          {(product.category || 'Uncategorized').toUpperCase()}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#4338ca]/10 px-3 py-1 text-xs font-semibold text-[#4338ca] dark:bg-[#4338ca]/20 dark:text-zinc-100">
                        {price}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold',
                          stock > 0
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                        )}
                      >
                        {stock > 0 ? (
                          <>
                            <CheckCircle2
                              className="size-3"
                              strokeWidth={1.75}
                            />
                            {stock} in stock
                          </>
                        ) : (
                          <>
                            <ShieldAlert
                              className="size-3"
                              strokeWidth={1.75}
                            />
                            Out of stock
                          </>
                        )}
                      </span>
                      {product.stripeProductId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#4338ca]/10 px-3 py-1 font-semibold text-[#4338ca] dark:bg-[#4338ca]/20 dark:text-zinc-100">
                          <ShieldCheck className="size-3" strokeWidth={1.75} />
                          Stripe linked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          Awaiting Stripe sync
                        </span>
                      )}
                    </div>

                    <div className="mt-auto flex gap-2">
                      <Link
                        href={`/admin/product/${encodeURIComponent(id)}/edit`}
                        className={cardActionClass}
                      >
                        Edit
                        <ArrowUpRight className="size-4" strokeWidth={1.75} />
                      </Link>
                      <Link
                        href={`/admin/product/${encodeURIComponent(id)}/delete`}
                        className={deleteActionClass}
                      >
                        Delete
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'success' | 'muted'
}) {
  const classes =
    tone === 'success'
      ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
      : 'inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
  return <span className={classes}>{children}</span>
}
