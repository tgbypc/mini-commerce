'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCart } from '@/context/CartContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'react-hot-toast'

// ——— UI model (PDP) ———
// Firestore doc id is string. Keep optional fields defensive.
// We listen with onSnapshot so stock / title updates reflect live on PDP.

type PDPProduct = {
  id: string
  title: string
  price: number
  image?: string // main image (Vercel Blob or remote)
  thumbnail?: string // backward-compat (older docs)
  description?: string
  category?: string
  brand?: string
  stock?: number // optional in PRD but supported if present
}

export default function ProductDetailClient({ id }: { id: string }) {
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
          title: String(data.title ?? 'Item'),
          price: Number.isFinite(Number(data.price)) ? Number(data.price) : 0,
          image:
            typeof data.image === 'string' ? (data.image as string) : undefined,
          thumbnail:
            typeof data.thumbnail === 'string'
              ? (data.thumbnail as string)
              : undefined,
          description:
            typeof data.description === 'string'
              ? (data.description as string)
              : undefined,
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
  }, [id])

  // ——— Loading skeleton ———
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="aspect-square w-full rounded-xl border bg-slate-100 animate-pulse" />
        <div className="space-y-4">
          <div className="h-7 w-64 bg-slate-200 rounded animate-pulse" />
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-20 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-10 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="rounded-xl border p-6 text-sm text-zinc-600">
        Product not found.
      </div>
    )
  }

  const inStock = (product.stock ?? 0) > 0
  const maxQty = Math.min(product.stock ?? 10, 10) // UI limit: 10 per purchase
  const displayImg = product.image ?? product.thumbnail

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
      toast.error('Favorilere eklemek için lütfen giriş yapın')
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
      toast.error('Favori işlemi başarısız')
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* ——— Left: Media ——— */}
      <div>
        {displayImg ? (
          <div className="relative w-full aspect-square rounded-xl border overflow-hidden">
            <Image
              src={displayImg}
              alt={product.title}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-xl border bg-slate-100" />
        )}
        {/* Secondary info cards */}
        <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border p-3">🚚 Free returns (14 days)</div>
          <div className="rounded-lg border p-3">🔒 Secure checkout</div>
          <div className="rounded-lg border p-3">💬 Support 7/24</div>
        </div>
      </div>

      {/* ——— Right: Buy box ——— */}
      <div className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight">
            {product.title}
          </h1>
          <div className="flex items-center gap-3">
            <div className="text-xl font-medium">${product.price.toFixed(2)}</div>
            <button
              type="button"
              aria-pressed={isFavorite(product.id)}
              onClick={handleFav}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                isFavorite(product.id) ? 'bg-rose-50 text-rose-700 border-rose-200' : 'hover:bg-zinc-50'
              }`}
            >
              <span>❤</span>
              <span>{isFavorite(product.id) ? 'Favorilerde' : 'Favorilere ekle'}</span>
            </button>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {inStock ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> In
                stock
                {typeof product.stock === 'number'
                  ? ` · ${product.stock} left`
                  : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 text-rose-700 px-3 py-1 border border-rose-200">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Out of
                stock
              </span>
            )}
            {product.category && (
              <span className="text-zinc-500">
                Category: {product.category}
              </span>
            )}
            {product.brand && (
              <span className="text-zinc-500">Brand: {product.brand}</span>
            )}
          </div>
        </div>

        {product.description && (
          <p className="text-zinc-700 leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        )}

        {/* Quantity + Add to Cart */}
        <div className="flex items-end gap-4">
          <label className="block text-sm">
            <span className="block mb-1 text-zinc-600">Quantity</span>
            <select
              className="rounded-lg border px-3 py-2"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              disabled={!inStock}
            >
              {Array.from({ length: Math.max(maxQty, 1) }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                )
              )}
            </select>
          </label>

          <button
            onClick={handleAdd}
            disabled={!inStock}
            className={`rounded-xl px-5 h-11 ${
              inStock
                ? 'bg-black text-white hover:opacity-90'
                : 'bg-zinc-300 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {inStock ? 'Add to Cart' : 'Out of stock'}
          </button>
        </div>

        {/* Specs section (collapsible-ready; simple for now) */}
        <div className="pt-6 border-t space-y-2 text-sm">
          <div className="font-medium">Product details</div>
          <ul className="list-disc ml-5 text-zinc-700">
            {product.category && <li>Category: {product.category}</li>}
            {product.brand && <li>Brand: {product.brand}</li>}
            <li>Price: ${product.price.toFixed(2)}</li>
            {typeof product.stock === 'number' && (
              <li>Stock: {product.stock}</li>
            )}
          </ul>
        </div>

        <div className="pt-4 border-t text-sm text-zinc-600">
          * Actual inventory decreases after a successful checkout.
        </div>
      </div>
    </div>
  )
}
