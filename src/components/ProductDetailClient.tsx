'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCart } from '@/context/CartContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'react-hot-toast'
import { useI18n } from '@/context/I18nContext'
import { pickI18nString } from '@/lib/i18nContent'

type PDPProduct = {
  id: string
  title: string
  price: number
  image?: string
  thumbnail?: string
  description?: string
  category?: string
  brand?: string
  stock?: number
}

export default function ProductDetailClient({ id }: { id: string }) {
  const { locale, t } = useI18n()
  const { add } = useCart()
  const { toggle, isFavorite } = useFavorites()
  const { user } = useAuth()
  const [product, setProduct] = useState<PDPProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    const ref = doc(db, 'products', id)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLoading(false)
        if (!snap.exists()) {
          setProduct(null)
          return
        }
        const data = snap.data() as Record<string, unknown>
        const p: PDPProduct = {
          id: String(data.id ?? id),
          title: pickI18nString(data, 'title', locale) || 'Item',
          price: Number.isFinite(Number(data.price)) ? Number(data.price) : 0,
          image:
            typeof data.image === 'string' ? (data.image as string) : undefined,
          thumbnail:
            typeof data.thumbnail === 'string'
              ? (data.thumbnail as string)
              : undefined,
          description: (pickI18nString(data, 'description', locale) ||
            undefined) as string | undefined,
          category:
            typeof data.category === 'string'
              ? (data.category as string)
              : undefined,
          brand: typeof data.brand === 'string' ? data.brand : undefined,
          stock: typeof data.stock === 'number' ? data.stock : undefined,
        }
        setProduct(p)
      },
      (err) => {
        console.error(err)
        setLoading(false)
        setProduct(null)
        toast.error('Failed to load product')
      }
    )
    return () => unsub()
  }, [id, locale])

  if (loading) {
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/60 p-3 shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
          <div className="aspect-square w-full rounded-2xl bg-zinc-100 animate-pulse" />
        </div>
        <div className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white/75 p-6 shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
          <div className="h-7 w-48 rounded bg-zinc-200 animate-pulse" />
          <div className="h-5 w-32 rounded bg-zinc-100 animate-pulse" />
          <div className="h-24 w-full rounded bg-zinc-100 animate-pulse" />
          <div className="h-11 w-40 rounded bg-zinc-200 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 text-sm text-zinc-600 shadow-sm">
        Product not found.
      </div>
    )
  }

  const inStock = (product.stock ?? 0) > 0
  const maxQty = Math.min(product.stock ?? 10, 10)
  const displayImg = product.image ?? product.thumbnail

  const detailsLabels = {
    heading: t('product.specHeading'),
    category: t('product.labels.category'),
    brand: t('product.labels.brand'),
    price: t('product.labels.price'),
    stock: t('product.labels.stock'),
  }

  const handleAdd = async () => {
    try {
      await add(
        {
          productId: String(product.id),
          title: product.title,
          price: product.price,
          thumbnail: displayImg,
        },
        qty
      )
      toast.success('Added to cart')
    } catch (e) {
      console.error(e)
      toast.error('Failed to add to cart')
    }
  }

  const handleFav = async () => {
    if (!product) return
    if (!user) {
      toast.error('Please sign in to manage favorites')
      return
    }
    try {
      await toggle({
        productId: product.id,
        title: product.title,
        thumbnail: displayImg,
        price: product.price,
      })
    } catch (e) {
      console.error(e)
      toast.error('Failed to update favorites')
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/90 p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
        {displayImg ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#f4f4f5] via-white to-[#eceff7]">
            <Image
              src={displayImg}
              alt={product.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 520px"
            />
          </div>
        ) : (
          <div className="aspect-square w-full rounded-2xl bg-zinc-100" />
        )}

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          {[{ icon: '🚚', text: 'Free returns (14 days)' }, { icon: '🔒', text: 'Secure checkout' }, { icon: '💬', text: 'Support 7/24' }].map((item) => (
            <div
              key={item.text}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 text-zinc-600 shadow-sm"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-[#f4f4f5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
            {product.brand || 'Collection'}
          </div>
          <h1 className="text-2xl font-semibold leading-tight text-[#0d141c]">
            {product.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold text-[#0d141c]">
              ${product.price.toFixed(2)}
            </span>
            <button
              type="button"
              aria-pressed={isFavorite(product.id)}
              onClick={handleFav}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium transition ${
                isFavorite(product.id)
                  ? 'border border-rose-200 bg-rose-50 text-rose-700 shadow-sm'
                  : 'border border-zinc-200 bg-white text-[#0d141c] hover:bg-[#f4f4f5]'
              }`}
            >
              <span>❤</span>
              <span>{isFavorite(product.id) ? 'In favorites' : 'Add to favorites'}</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {inStock ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                In stock
                {typeof product.stock === 'number' ? ` · ${product.stock} left` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Out of stock
              </span>
            )}
            {product.category && (
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-[#f4f4f5] px-3 py-1 text-zinc-600">
                <span className="h-2 w-2 rounded-full bg-[#0d141c]" /> {product.category}
              </span>
            )}
          </div>
        </div>

        {product.description && (
          <p className="text-sm leading-relaxed text-zinc-600">
            {product.description}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-4 border border-zinc-200 bg-white/70 px-4 py-4 rounded-2xl">
          <label className="flex flex-col text-sm font-medium text-zinc-600">
            <span className="mb-1">Quantity</span>
            <div className="relative">
              <select
                className="h-11 w-28 appearance-none rounded-2xl border border-zinc-200 bg-[#f4f4f5] px-4 pr-8 text-sm font-semibold text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                disabled={!inStock}
              >
                {Array.from({ length: Math.max(maxQty, 1) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="m7 9 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </label>

          <button
            onClick={handleAdd}
            disabled={!inStock}
            className={`inline-flex h-11 min-w-[160px] items-center justify-center rounded-full px-6 text-sm font-semibold transition ${
              inStock
                ? 'bg-[#0d141c] text-white hover:bg-[#1f2a37]'
                : 'cursor-not-allowed bg-zinc-300 text-zinc-600'
            }`}
          >
            {inStock ? 'Add to Cart' : 'Out of stock'}
          </button>
        </div>

        <div className="space-y-2 border-t border-dashed border-zinc-200 pt-4 text-sm text-zinc-600">
          <div className="font-medium text-[#0d141c]">{detailsLabels.heading}</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {product.category && (
              <li>
                {detailsLabels.category}: {product.category}
              </li>
            )}
            {product.brand && (
              <li>
                {detailsLabels.brand}: {product.brand}
              </li>
            )}
            <li>
              {detailsLabels.price}: ${product.price.toFixed(2)}
            </li>
            {typeof product.stock === 'number' && (
              <li>
                {detailsLabels.stock}: {product.stock}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
