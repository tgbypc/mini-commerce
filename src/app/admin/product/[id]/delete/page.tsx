'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/types/product'

export default function DeleteProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/product?id=${id}`)
        if (!alive) return
        if (!res.ok) {
          setError('Product not found')
          return
        }
        const p = await res.json()
        setProduct(p)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Failed to load product')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  const onDelete = async () => {
    if (!product) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/product?id=${product.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to delete product')
      }
      router.push('/admin/product')
    } catch (e) {
      setDeleting(false)
      setError(e instanceof Error ? e.message : 'Failed to delete product')
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl p-6 space-y-3">
        <div className="h-7 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="h-48 w-full bg-slate-100 rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border p-4 text-sm text-rose-600">{error}</div>
    )
  }

  if (!product) {
    return (
      <div className="rounded-xl border p-4 text-sm text-zinc-600">
        Product not found.
      </div>
    )
  }

  // Safely pick a preview image
  const images = (product as unknown as { images?: unknown }).images
  const firstImage =
    Array.isArray(images) && images.length > 0 && typeof images[0] === 'string'
      ? images[0]
      : undefined

  const img =
    firstImage ||
    (typeof (product as unknown as { image?: unknown }).image === 'string'
      ? (product as unknown as { image?: string }).image
      : undefined) ||
    (typeof (product as unknown as { thumbnail?: unknown }).thumbnail ===
    'string'
      ? (product as unknown as { thumbnail?: string }).thumbnail
      : undefined) ||
    ''

  return (
    <div className="max-w-xl p-6 space-y-5">
      <h1 className="text-2xl font-semibold">Delete product</h1>
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-start gap-4">
          <div className="relative w-28 h-28 rounded-lg overflow-hidden bg-slate-100">
            {img ? (
              <Image
                src={img}
                alt={product.title}
                fill
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-zinc-500">You are about to delete</div>
            <div className="text-lg font-medium truncate" title={product.title}>
              {product.title}
            </div>
            <div className="text-sm text-zinc-600">
              ${Number(product.price).toFixed(2)}
            </div>
          </div>
        </div>
        <p className="text-sm text-zinc-700">
          This action will remove the product from Firestore. If the images were
          uploaded to Vercel Blob, they will be deleted as well.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          disabled={deleting}
          onClick={onDelete}
          className="rounded-xl bg-rose-600 text-white px-4 py-2 disabled:opacity-60"
        >
          {deleting ? 'Deleting…' : 'Delete permanently'}
        </button>
        <Link href="/admin/product" className="rounded-xl border px-4 py-2">
          Cancel
        </Link>
      </div>
    </div>
  )
}
