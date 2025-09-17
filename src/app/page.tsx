'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
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
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'createdAt-desc' | 'price-asc' | 'price-desc' | 'title-asc' | 'title-desc'>('createdAt-desc')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const inFlight = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [activeCat, setActiveCat] = useState<string>('Tüm Ürünler')
  const categories = [
    'Tüm Ürünler',
    'Elektronik',
    'Giyim',
    'Ev & Mutfak',
    'Kitaplar',
  ]
  const catMap: Record<string, string> = {
    Elektronik: 'electronics',
    Giyim: 'clothing',
    'Ev & Mutfak': 'home & kitchen',
    Kitaplar: 'books',
  }
  const norm = (s?: string) => (s || '').toLowerCase().trim()
  const catParam = useMemo(() => (activeCat === 'Tüm Ürünler' ? '' : catMap[activeCat] ?? ''), [activeCat])

  async function fetchPage(opts: { cursor?: string | null; reset?: boolean }) {
    if (inFlight.current) return
    inFlight.current = true
    try {
      if (opts.reset) setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (catParam) params.set('category', catParam)
      const q = search.trim()
      if (q) params.set('q', q)
      if (sort) params.set('sort', sort)
      if (opts.cursor) params.set('cursor', opts.cursor)

      const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Ürünler yüklenemedi: ${res.status}`)
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
      const msg = e instanceof Error ? e.message : 'Ürünler yüklenemedi'
      setError(msg)
      if (opts.reset) setItems([])
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  // İlk yükleme ve kategori/sort değişiminde ilk sayfayı getir
  useEffect(() => {
    fetchPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catParam, sort])

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
        <div className="px-0 md:px-4 py-3">
          <label className="flex h-12 w-full">
            <div className="flex w-full items-stretch rounded-xl overflow-hidden">
              <div className="text-[#49739c] flex items-center justify-center pl-4 bg-[#e7edf4]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                >
                  <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                </svg>
              </div>
              <input
                placeholder="Ürünleri ara"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input flex-1 border-none bg-[#e7edf4] outline-none px-4 text-base rounded-r-xl placeholder:text-[#49739c]"
              />
              <button
                type="button"
                onClick={() => setSearch('')}
                className="px-3 text-sm text-[#49739c] bg-[#e7edf4]"
                aria-label="Aramayı temizle"
              >
                Temizle
              </button>
            </div>
          </label>
        </div>

        <div className="flex gap-3 p-3 flex-wrap">
          {categories.map((c) => {
            const active = c === activeCat
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveCat(c)}
                className={
                  `h-8 items-center justify-center rounded-xl px-4 text-sm font-medium transition ` +
                  (active
                    ? 'bg-[#dfe7f1] text-[#0d141c] ring-1 ring-[#cedbe8]'
                    : 'bg-[#e7edf4] text-[#0d141c] hover:bg-[#dfe7f1]')
                }
              >
                {c}
              </button>
            )
          })}
        </div>

        {/* Öne Çıkan Ürünler */}
        <h3 className="text-[#0d141c] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">
          Öne Çıkan Ürünler
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
            Sonuç bulunamadı.
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
          Tüm Ürünler
        </h3>
        <div className="flex max-w-[720px] items-end gap-4 px-4 py-3 flex-wrap">
          <label className="flex flex-col min-w-40 flex-1">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="h-14 rounded-xl border border-[#cedbe8] bg-slate-50 px-4"
            >
              <option value="createdAt-desc">En Yeni</option>
              <option value="price-asc">Fiyat (Artan)</option>
              <option value="price-desc">Fiyat (Azalan)</option>
              <option value="title-asc">Başlık (A→Z)</option>
              <option value="title-desc">Başlık (Z→A)</option>
            </select>
          </label>
          {nextCursor && (
            <button
              type="button"
              onClick={() => fetchPage({ cursor: nextCursor })}
              className="h-14 rounded-xl border px-4 text-sm font-medium hover:bg-zinc-50"
              disabled={inFlight.current}
            >
              {inFlight.current ? 'Yükleniyor…' : 'Daha Fazla Yükle'}
            </button>
          )}
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
