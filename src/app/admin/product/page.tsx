'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Product } from '@/types/product'
import { getAllProducts } from '@/lib/products'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'

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
  const [syncing, setSyncing] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillingNb, setBackfillingNb] = useState(false)
  const [backfillingLC, setBackfillingLC] = useState(false)
  const [i18nMap, setI18nMap] = useState<Record<string, { en: boolean; nb: boolean }>>({})

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const list = await getAllProducts()
        if (!alive) return
        setItems(list)
      } catch (e: unknown) {
        if (!alive) return
        if (e instanceof Error) {
          setError(e.message)
        } else {
          setError('Failed to load products')
        }
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
        const data = (await res.json()) as { items?: { id: string; en: boolean; nb: boolean }[] }
        const map: Record<string, { en: boolean; nb: boolean }> = {}
        for (const row of data.items || []) map[row.id] = { en: row.en, nb: row.nb }
        if (alive) setI18nMap(map)
      } catch {}
    })()
    return () => {
      alive = false
    }
  }, [items, user])

  const handleSyncStripe = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      if (!token) {
        throw new Error('Admin kimlik doğrulaması başarısız')
      }
      const res = await fetch('/api/admin/stripe/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data: unknown = await res.json()

      // Show a brief summary to the admin
      let summary = 'Stripe sync completed.'
      if (typeof data === 'object' && data) {
        const obj = data as Record<string, unknown>
        const processed =
          typeof obj.processed === 'number' ? obj.processed : undefined
        const skipped =
          typeof obj.skipped === 'number' ? obj.skipped : undefined
        let errorsCount: number | undefined
        const maybeErrors = (obj as Record<string, unknown>).errors
        if (Array.isArray(maybeErrors)) {
          errorsCount = maybeErrors.length
        }
        summary = `Processed: ${processed ?? '-'} | Skipped: ${
          skipped ?? '-'
        } | Errors: ${errorsCount ?? '-'}`
      }

      alert(summary)

      try {
        const list = await getAllProducts()
        setItems(list)
      } catch {}
    } catch {
      alert('Failed to sync Stripe IDs')
    } finally {
      setSyncing(false)
    }
  }

  const handleBackfill = async () => {
    if (backfilling) return
    setBackfilling(true)
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      const res = await fetch('/api/admin/products/backfill-i18n?mode=copy-base-to-en', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      const summary = res.ok
        ? `Backfill OK — updated: ${data?.updated ?? '-'} / processed: ${data?.processed ?? '-'}`
        : `Backfill failed: ${data?.error ?? res.status}`
      alert(summary)
      try {
        const list = await getAllProducts()
        setItems(list)
      } catch {}
    } catch {
      alert('Backfill request failed')
    } finally {
      setBackfilling(false)
    }
  }

  const handleBackfillNb = async () => {
    if (backfillingNb) return
    setBackfillingNb(true)
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      const res = await fetch('/api/admin/products/backfill-i18n?mode=copy-en-to-nb', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      const summary = res.ok
        ? `NB backfill — updated: ${data?.updated ?? '-'} / processed: ${data?.processed ?? '-'}`
        : `Backfill failed: ${data?.error ?? res.status}`
      alert(summary)
      try {
        const list = await getAllProducts()
        setItems(list)
      } catch {}
    } catch {
      alert('Backfill NB request failed')
    } finally {
      setBackfillingNb(false)
    }
  }

  const handleBackfillTitleLC = async () => {
    if (backfillingLC) return
    setBackfillingLC(true)
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      const res = await fetch('/api/admin/products/backfill-titlelc', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      const summary = res.ok
        ? `title_lc backfill — updated: ${data?.updated ?? '-'} / total: ${data?.total ?? '-'}`
        : `Backfill failed: ${data?.error ?? res.status}`
      alert(summary)
      try {
        const list = await getAllProducts()
        setItems(list)
      } catch {}
    } catch {
      alert('Backfill title_lc request failed')
    } finally {
      setBackfillingLC(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('admin.products')}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncStripe}
            disabled={syncing}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          >
            {syncing ? t('admin.saving') : t('admin.syncStripe')}
          </button>
          <button
            type="button"
            onClick={handleBackfill}
            disabled={backfilling}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            title="Copy base title/description into title_en/description_en where missing"
          >
            {backfilling ? t('admin.saving') : t('admin.backfillEn')}
          </button>
          <button
            type="button"
            onClick={handleBackfillNb}
            disabled={backfillingNb}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            title="Fill Norwegian fields from English where missing"
          >
            {backfillingNb ? t('admin.saving') : 'Copy EN → NB'}
          </button>
          <button
            type="button"
            onClick={handleBackfillTitleLC}
            disabled={backfillingLC}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            title="Populate title_en_lc/title_nb_lc for case-insensitive search"
          >
            {backfillingLC ? t('admin.saving') : 'Backfill title_lc'}
          </button>
          <Link
            href="/admin/product/new"
            className="rounded-lg bg-black px-3 py-2 text-sm text-white"
          >
            + {t('admin.add')}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-xl p-3">
              <div className="aspect-video w-full rounded-lg bg-slate-100 animate-pulse" />
              <div className="h-4 w-40 bg-slate-200 rounded mt-3 animate-pulse" />
              <div className="h-4 w-24 bg-slate-200 rounded mt-2 animate-pulse" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border p-4 text-sm text-rose-600">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border p-4 text-sm text-zinc-600">
          No products yet. Start by adding one.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {items.map((p) => {
            const id = String(p.id ?? '')
            const img =
              (Array.isArray(p.images) && p.images.length > 0
                ? p.images[0]
                : undefined) ??
              p.thumbnail ??
              ''
            const price = Number(p.price) || 0
            const stock = typeof p.stock === 'number' ? p.stock : undefined
            return (
              <div key={id} className="border rounded-xl p-3 space-y-2">
                <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-slate-50">
                  {img ? (
                    <Image
                      src={normalizeImageSrc(String(img))}
                      alt={p.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100" />
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {(() => {
                      const st = i18nMap[id]
                      const cls = (ok: boolean) =>
                        `px-1.5 py-0.5 rounded text-[10px] font-semibold border ${ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-600 border-zinc-200'}`
                      return (
                        <>
                          <span className={cls(!!st?.en)}>EN</span>
                          <span className={cls(!!st?.nb)}>NB</span>
                        </>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      title={p.title}
                    >
                      {p.title}
                    </div>
                    <div className="text-xs text-zinc-600">
                      ${price.toFixed(2)}
                    </div>
                  </div>
                  {typeof stock === 'number' && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] border ${
                        stock > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/admin/product/${encodeURIComponent(id)}/edit`}
                    className="rounded-md border px-3 py-1 text-sm"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/admin/product/${encodeURIComponent(id)}/delete`}
                    className="rounded-md border px-3 py-1 text-sm"
                  >
                    Delete
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
