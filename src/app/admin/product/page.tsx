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
      toast.error(
        e instanceof Error ? e.message : 'Backfill request failed',
        { id: toastId }
      )
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
      toast.error(
        e instanceof Error ? e.message : 'Backfill request failed',
        { id: toastId }
      )
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
      toast.error(
        e instanceof Error ? e.message : 'Backfill request failed',
        { id: toastId }
      )
    } finally {
      setBackfillingLC(false)
    }
  }, [backfillingLC, handleLoadProducts, user])

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  return (
    <div className="space-y-8 text-[rgb(var(--admin-text-rgb))]">
      <div className="admin-section flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-blue-600/60">
            Catalog
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('admin.products')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--admin-muted-rgb))]">
            Manage product data, localization, Stripe sync, and inventory health
            from a single responsive workspace.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleSyncStripe}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/12 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-400/45 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <RefreshCcw className="size-4" strokeWidth={1.75} />
            )}
            {syncing ? t('admin.saving') : t('admin.syncStripe')}
          </button>
          <button
            type="button"
            onClick={handleBackfill}
            disabled={backfilling}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/12 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-400/45 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            title="Copy base content into English locales where missing"
          >
            {backfilling ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Sparkles className="size-4" strokeWidth={1.75} />
            )}
            {backfilling ? t('admin.saving') : t('admin.backfillEn')}
          </button>
          <button
            type="button"
            onClick={handleBackfillNb}
            disabled={backfillingNb}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/12 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-400/45 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            title="Copy English localization into Norwegian where missing"
          >
            {backfillingNb ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Sparkles className="size-4" strokeWidth={1.75} />
            )}
            {backfillingNb ? t('admin.saving') : 'Copy EN → NB'}
          </button>
          <button
            type="button"
            onClick={handleBackfillTitleLC}
            disabled={backfillingLC}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/12 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-400/45 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            title="Populate lowercase search variants for all locales"
          >
            {backfillingLC ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <PackageSearch className="size-4" strokeWidth={1.75} />
            )}
            {backfillingLC ? t('admin.saving') : 'Backfill search'}
          </button>
          <Link
            href="/admin/product/new"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-500/35 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-700 shadow-[0_12px_32px_-18px_rgba(59,130,246,0.5)] transition hover:border-blue-500/55 hover:bg-blue-500/25"
          >
            + {t('admin.add')}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="admin-section flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex w-full items-center gap-3 rounded-2xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.9)] px-4 py-2.5 text-sm text-[var(--foreground)] shadow-inner shadow-[0_12px_24px_-18px_rgba(15,23,42,0.18)] focus-within:border-blue-400/45 focus-within:bg-blue-500/12 md:max-w-xl">
            <Search className="size-4 text-blue-500" strokeWidth={1.75} />
            <input
              value={query}
              onChange={handleSearchChange}
              placeholder="Search by name, brand, category, SKU…"
              className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-[rgb(var(--admin-muted-rgb))] focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'low-stock', label: 'Low stock' },
                { key: 'missing-en', label: 'Missing EN' },
                { key: 'missing-nb', label: 'Missing NB' },
              ] as { key: FilterKey; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] transition',
                  filter === key
                    ? 'border border-blue-400/55 bg-blue-500/20 text-blue-700 shadow-[0_4px_20px_-8px_rgba(59,130,246,0.6)]'
                    : 'border border-blue-400/20 bg-blue-500/8 text-blue-600 hover:border-blue-400/35 hover:bg-blue-500/15'
                )}
              >
                {label}
                {key === 'low-stock' && lowStockCount > 0 && (
                  <span className="ml-2 rounded-full bg-blue-500/18 px-2 py-0.5 text-[10px] text-blue-700">
                    {lowStockCount}
                  </span>
                )}
                {key === 'missing-en' && missingEnCount > 0 && (
                  <span className="ml-2 rounded-full bg-blue-500/18 px-2 py-0.5 text-[10px] text-blue-700">
                    {missingEnCount}
                  </span>
                )}
                {key === 'missing-nb' && missingNbCount > 0 && (
                  <span className="ml-2 rounded-full bg-blue-500/18 px-2 py-0.5 text-[10px] text-blue-700">
                    {missingNbCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-section space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-blue-600/60">
            Snapshot
          </p>
          <div className="mt-3 space-y-2 text-sm text-[rgb(var(--admin-muted-rgb))]">
            <p>
              <span className="text-[var(--foreground)]">{items.length}</span> total products
            </p>
            <p>
              <span className="text-[var(--foreground)]">{lowStockCount}</span> items below 5
              units
            </p>
            <p>
              <span className="text-[var(--foreground)]">{missingEnCount}</span> missing EN
              localization
            </p>
            <p>
              <span className="text-[var(--foreground)]">{missingNbCount}</span> missing NB
              localization
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-3xl admin-surface p-4"
            >
              <div className="aspect-video w-full rounded-2xl bg-[rgba(var(--admin-border-rgb),0.08)]" />
              <div className="mt-4 h-4 w-3/4 rounded bg-[rgba(var(--admin-border-rgb),0.12)]" />
              <div className="mt-2 h-4 w-1/2 rounded bg-[rgba(var(--admin-border-rgb),0.08)]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-5 text-sm text-rose-700">
          {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-3xl admin-surface p-6 text-sm text-[rgb(var(--admin-muted-rgb))]">
          No products match this view. Try clearing filters or syncing your
          catalog.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((product) => {
            const id = String(product.id ?? '')
            const translation = i18nMap[id]
            const stock =
              typeof product.stock === 'number' && Number.isFinite(product.stock)
                ? product.stock
                : 0
            const primaryImage =
              (Array.isArray(product.images) && product.images.length > 0
                ? product.images[0]
                : undefined) ??
              product.thumbnail ??
              ''
            const price = formatPrice(product.price)
            return (
              <div
                key={id}
                className="group flex h-full flex-col rounded-3xl admin-surface p-4 transition hover:shadow-[0_22px_45px_-30px_rgba(37,99,235,0.35)]"
              >
                <div className="relative overflow-hidden rounded-2xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.92)]">
                  {primaryImage ? (
                    <Image
                      src={normalizeImageSrc(String(primaryImage))}
                      alt={product.title}
                      width={640}
                      height={420}
                      className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-52 w-full items-center justify-center text-sm text-[rgb(var(--admin-muted-rgb))]">
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
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">
                        {product.title}
                      </h3>
                      <p className="truncate text-xs uppercase tracking-[0.22em] text-[rgb(var(--admin-muted-rgb))]">
                        {product.brand || '—'} • {product.category || 'uncategorized'}
                      </p>
                    </div>
                    <span className="admin-chip admin-chip--accent shrink-0 px-3 py-1 text-[0.7rem]">
                      {price}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={clsx(
                        'admin-chip px-2 py-1 font-semibold',
                        stock > 0 ? 'admin-chip--success' : 'admin-chip--danger'
                      )}
                    >
                      {stock > 0 ? (
                        <>
                          <CheckCircle2 className="size-3" strokeWidth={1.75} />
                          {stock} in stock
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="size-3" strokeWidth={1.75} />
                          Out of stock
                        </>
                      )}
                    </span>
                    {product.stripeProductId ? (
                      <span className="admin-chip admin-chip--info px-2 py-1 text-[0.65rem]">
                        <ShieldCheck className="size-3" strokeWidth={1.75} />
                        Stripe linked
                      </span>
                    ) : (
                      <span className="admin-chip admin-chip--warning px-2 py-1 text-[0.65rem]">
                        Awaiting Stripe sync
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex gap-2">
                    <Link
                      href={`/admin/product/${encodeURIComponent(id)}/edit`}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.92)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12"
                    >
                      Edit
                      <ArrowUpRight className="size-4" strokeWidth={1.75} />
                    </Link>
                    <Link
                      href={`/admin/product/${encodeURIComponent(id)}/delete`}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-400/35 bg-rose-500/12 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-400/55 hover:bg-rose-500/20"
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
      ? 'admin-tag-mini admin-tag-mini--success'
      : 'admin-tag-mini admin-tag-mini--muted'
  return <span className={classes}>{children}</span>
}
