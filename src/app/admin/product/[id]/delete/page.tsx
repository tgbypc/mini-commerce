'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { AlertTriangle, ArrowLeftCircle, Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type AdminProductPreview = {
  id: string
  title: string
  price: number
  thumbnail?: string
  images: string[]
}

function formatPrice(amount: number) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
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
          setError('You need admin privileges to perform this action.')
          setFetching(false)
        }
        return
      }
      try {
        const token = await user.getIdToken().catch(() => undefined)
        if (!token) {
          throw new Error('Failed to verify admin identity')
        }
        const res = await fetch(
          `/api/admin/product?id=${encodeURIComponent(id)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          }
        )
        if (!alive) return
        if (!res.ok) {
          setError('Product not found or already deleted.')
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
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0
        )

        const preview: AdminProductPreview = {
          id: pickString((raw as { id?: unknown }).id) ?? id,
          title:
            pickString((raw as { title?: unknown }).title) ?? 'Unnamed product',
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

  const previewImage = useMemo(() => {
    if (!product) return ''
    const firstImage = product.images.length > 0 ? product.images[0] : undefined
    return product.thumbnail ?? firstImage ?? ''
  }, [product])

  const handleDelete = async () => {
    if (!product) return
    if (!user) {
      toast.error('You need admin privileges to perform this action.')
      return
    }
    setDeleting(true)
    const toastId = toast.loading('Deleting product…')
    try {
      const token = await user.getIdToken().catch(() => undefined)
      if (!token) throw new Error('Failed to verify admin identity')
      const res = await fetch(
        `/api/admin/product?id=${encodeURIComponent(product.id)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      if (!res.ok) {
        const data = await res.json()
        const message =
          (data && typeof data.message === 'string' && data.message) ||
          'Failed to delete product'
        throw new Error(message)
      }
      toast.success('Product deleted', { id: toastId })
      router.push('/admin/product')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete product', {
        id: toastId,
      })
    } finally {
      setDeleting(false)
    }
  }

  if (fetching) {
    return (
      <div className="admin-card max-w-xl space-y-4 rounded-3xl p-6">
        <div className="h-7 w-64 animate-pulse rounded bg-[rgba(var(--admin-border-rgb),0.12)]" />
        <div className="h-48 w-full animate-pulse rounded-2xl bg-[rgba(var(--admin-border-rgb),0.08)]" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-[rgba(var(--admin-border-rgb),0.1)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-xl space-y-4 rounded-3xl border border-rose-400/35 bg-rose-500/12 p-6 text-sm text-rose-700">
        <div className="flex items-center gap-2 text-rose-600">
          <AlertTriangle className="size-4" />
          <span>Delete product</span>
        </div>
        <p>{error}</p>
        <Link
          href="/admin/product"
          className="inline-flex items-center gap-2 rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12"
        >
          <ArrowLeftCircle className="size-4" />
          Back to catalog
        </Link>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="admin-card rounded-3xl p-6 text-sm text-[rgb(var(--admin-muted-rgb))]">
        Product not found.
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6 text-[rgb(var(--admin-text-rgb))]">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.32em] text-rose-500/70">
          Danger zone
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Delete product
        </h1>
        <p className="max-w-xl text-sm text-rose-600/80">
          This action permanently removes the product from Firestore. Linked
          blobs will be deleted as well. This cannot be undone.
        </p>
      </header>

      <div className="rounded-3xl border border-rose-400/35 bg-rose-500/12 p-5">
        <div className="flex items-start gap-5">
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-rose-400/35 bg-rose-500/16">
            {previewImage ? (
              <Image
                src={previewImage}
                alt={product.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-rose-600/75">
                No image
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs uppercase tracking-[0.32em] text-rose-500/70">
              You are about to remove
            </p>
            <h2 className="truncate text-lg font-semibold" title={product.title}>
              {product.title}
            </h2>
            <p className="text-sm text-rose-600/80">
              {formatPrice(Number(product.price) || 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/55 bg-rose-500/18 px-6 py-2 text-sm font-semibold text-rose-700 shadow-[0_18px_35px_-20px_rgba(248,113,113,0.45)] transition hover:border-rose-500/75 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <Trash2 className="size-4" strokeWidth={1.75} />
          )}
          {deleting ? 'Deleting…' : 'Delete permanently'}
        </button>
        <Link
          href="/admin/product"
          className="inline-flex items-center justify-center gap-2 rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-6 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12"
        >
          <ArrowLeftCircle className="size-4" strokeWidth={1.75} />
          Cancel
        </Link>
      </div>
    </div>
  )
}
