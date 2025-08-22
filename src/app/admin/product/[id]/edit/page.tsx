'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getProductById } from '@/lib/products'
import type { Product } from '@/types/product'
import { CATEGORIES } from '@/lib/constants/categories'
import type { Category } from '@/lib/constants/categories'
import Image from 'next/image'

const schema = z.object({
  title: z.string().min(3, 'Min 3 karakter'),
  price: z.coerce.number().nonnegative('Fiyat negatif olamaz'),
  stock: z.coerce
    .number()
    .int()
    .min(0, 'Stok 0 veya daha büyük olmalı')
    .optional(),
  category: z.enum(CATEGORIES),
  brand: z.string().max(50).optional().or(z.literal('')),
  thumbnail: z
    .string()
    .url('Geçerli bir URL olmalı')
    .optional()
    .or(z.literal('')),
  images: z
    .string()
    .transform((s) => s.trim())
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .min(10, 'En az 10 karakter')
    .optional()
    .or(z.literal('')),
  tags: z
    .string()
    .transform((s) => s.trim())
    .optional()
    .or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [initial, setInitial] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
  })

  // Ürünü yükle ve formu doldur
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const p = await getProductById(String(id))
        if (!alive) return
        if (!p) {
          setError('Product not found')
          return
        }
        setInitial(p)
        // default form değerleri
        reset({
          title: p.title,
          price: Number(p.price) || 0,
          stock: typeof p.stock === 'number' ? p.stock : 0,
          category: (p.category as Category) ?? CATEGORIES[0],
          brand: p.brand ?? '',
          thumbnail:
            typeof p.thumbnail === 'string'
              ? p.thumbnail
              : typeof (p as unknown as { image?: string }).image === 'string'
              ? (p as unknown as { image?: string }).image
              : '',
          images: Array.isArray((p as unknown as { images?: string[] }).images)
            ? ((p as unknown as { images?: string[] }).images || []).join(', ')
            : '',
          description: p.description ?? '',
          tags: Array.isArray((p as unknown as { tags?: string[] }).tags)
            ? ((p as unknown as { tags?: string[] }).tags || []).join(', ')
            : '',
        })
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
  }, [id, reset])

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (!initial) return
    const imagesArr: string[] = values.images
      ? values.images
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : []
    const tagsArr: string[] = values.tags
      ? values.tags
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : []

    // Firestore update
    const ref = doc(db, 'products', String(initial.id))
    await updateDoc(ref, {
      title: values.title,
      price: Number(values.price) || 0,
      stock: typeof values.stock === 'number' ? values.stock : 0,
      category: values.category,
      brand: values.brand || null,
      thumbnail: values.thumbnail || null,
      images: imagesArr,
      description: values.description || null,
      tags: tagsArr,
      updatedAt: serverTimestamp(),
    })

    // Stripe senkronizasyonu (price değişimi vb.)
    await fetch('/admin/stripe/sync-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: String(initial.id) }),
    })

    router.push('/admin/product')
  }

  const title = useMemo(
    () => (initial ? `Edit: ${initial.title}` : 'Edit product'),
    [initial]
  )

  if (loading) {
    return (
      <div className="max-w-2xl p-6">
        <div className="h-7 w-64 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="h-10 w-full bg-slate-100 rounded animate-pulse mb-3" />
        <div className="h-10 w-full bg-slate-100 rounded animate-pulse mb-3" />
        <div className="h-24 w-full bg-slate-100 rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border p-4 text-sm text-rose-600">{error}</div>
    )
  }

  if (!initial) {
    return (
      <div className="rounded-xl border p-4 text-sm text-zinc-600">
        Product not found.
      </div>
    )
  }

  return (
    <div className="max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <label className="block">
          <span className="block text-sm text-zinc-600 mb-1">Title</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            {...register('title')}
          />
          {errors.title && (
            <p className="text-sm text-rose-600">{errors.title.message}</p>
          )}
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm text-zinc-600 mb-1">Price</span>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border px-3 py-2"
              {...register('price')}
            />
            {errors.price && (
              <p className="text-sm text-rose-600">{errors.price.message}</p>
            )}
          </label>

          <label className="block">
            <span className="block text-sm text-zinc-600 mb-1">Stock</span>
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2"
              {...register('stock')}
            />
            {errors.stock && (
              <p className="text-sm text-rose-600">{errors.stock.message}</p>
            )}
          </label>
        </div>

        <label className="block">
          <span className="block text-sm text-zinc-600 mb-1">Category</span>
          <select
            className="w-full rounded-lg border px-3 py-2"
            {...register('category')}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="text-sm text-rose-600">{errors.category.message}</p>
          )}
        </label>

        <label className="block">
          <span className="block text-sm text-zinc-600 mb-1">Brand</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            {...register('brand')}
          />
        </label>

        <label className="block">
          <span className="block text-sm text-zinc-600 mb-1">
            Thumbnail (URL)
          </span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            {...register('thumbnail')}
          />
          {errors.thumbnail && (
            <p className="text-sm text-rose-600">{errors.thumbnail.message}</p>
          )}
        </label>
        {/* Upload image (Vercel Blob) */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            Upload image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files && e.target.files[0]
              if (!file) return
              const fd = new FormData()
              fd.append('file', file)
              const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: fd,
              })
              if (!res.ok) {
                console.error('Upload failed')
                return
              }
              const data: { url: string } = await res.json()
              setValue('thumbnail', data.url, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }}
            className="block w-full text-sm"
          />
          {watch('thumbnail') ? (
            <div className="mt-2 relative w-32 h-32 rounded border overflow-hidden">
              <Image
                src={watch('thumbnail')!}
                alt="Preview"
                fill
                sizes="128px"
                className="object-cover"
              />
            </div>
          ) : null}
        </div>

        <label className="block">
          <span className="block text-sm text-zinc-600 mb-1">
            Images (comma separated URLs)
          </span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            {...register('images')}
          />
        </label>

        <label className="block">
          <span className="block text-sm text-zinc-600 mb-1">Description</span>
          <textarea
            rows={5}
            className="w-full rounded-lg border px-3 py-2"
            {...register('description')}
          />
          {errors.description && (
            <p className="text-sm text-rose-600">
              {errors.description.message}
            </p>
          )}
        </label>

        <label className="block">
          <span className="block text-sm text-zinc-600 mb-1">
            Tags (comma separated)
          </span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            {...register('tags')}
          />
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-black text-white px-4 py-2"
          >
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/product')}
            className="rounded-xl border px-4 py-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
