'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

type AdminProductPreview = {
  id: string
  title: string
  price: number
  thumbnail?: string
  images: string[]
}

export default function DeleteProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [product, setProduct] = useState<AdminProductPreview | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!id) return
      if (authLoading) return
      if (!user) {
        if (alive) {
          setError('Not authorized')
          setFetching(false)
        }
        return
      }
      try {
        const token = await user.getIdToken().catch(() => undefined)
        if (!token) {
          throw new Error('Failed to acquire admin token')
        }
        const res = await fetch(`/api/admin/product?id=${encodeURIComponent(id)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        })
        if (!alive) return
        if (!res.ok) {
          setError('Product not found')
          return
        }
        const body = (await res.json()) as { product?: unknown }
        if (!body || typeof body !== 'object' || body === null || !('product' in body)) {
          throw new Error('Invalid response payload')
        }
        const raw = (body as { product?: Record<string, unknown> }).product
        if (!raw || typeof raw !== 'object') {
          throw new Error('Invalid product payload')
        }

        const pickString = (value: unknown): string | undefined => {
          if (typeof value !== 'string') return undefined
          const trimmed = value.trim()
          return trimmed.length > 0 ? trimmed : undefined
        }

        const pickNumber = (value: unknown): number | undefined => {
          if (typeof value === 'number' && Number.isFinite(value)) return value
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : undefined
        }

        const imagesRaw = Array.isArray(raw.images)
          ? (raw.images as unknown[])
          : []
        const images = imagesRaw.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0
        )

        const preview: AdminProductPreview = {
          id: pickString((raw as { id?: unknown }).id) ?? id,
          title: pickString((raw as { title?: unknown }).title) ?? 'Unnamed product',
          price: pickNumber((raw as { price?: unknown }).price) ?? 0,
          thumbnail: pickString((raw as { thumbnail?: unknown }).thumbnail),
          images,
        }

        setProduct(preview)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Failed to load product')
      } finally {
        if (alive) setFetching(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [authLoading, id, user])

  const onDelete = async () => {
    if (!product) return
    if (!user) {
      setError('Not authorized')
      return
    }
    setDeleting(true)
    try {
      const token = await user.getIdToken().catch(() => undefined)
      if (!token) {
        throw new Error('Failed to acquire admin token')
      }
      const res = await fetch(`/api/admin/product?id=${encodeURIComponent(product.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to delete product')
      }
      router.push('/admin/product')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete product')
    } finally {
      setDeleting(false)
    }
  }

  if (fetching) {
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

  const firstImage = product.images.length > 0 ? product.images[0] : undefined
  const img = product.thumbnail ?? firstImage ?? ''

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
