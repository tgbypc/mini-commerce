'use client'

import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'

import { CATEGORIES } from '@/lib/constants/categories'
import type { Category } from '@/lib/constants/categories'

// Strongly-typed form values used by RHF
export type ProductFormValues = {
  title: string
  price: number
  stock: number
  category: Category
  brand?: string
  thumbnail?: string
  images?: string // comma-separated in UI; we convert to string[] before sending
  description?: string
  tags?: string // comma-separated in UI
}

const isCsvOfUrls = (val?: string) => {
  const s = (val ?? '').trim()
  if (!s) return true
  const parts = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  if (parts.length === 0) return true
  return parts.every((u) => {
    try {
      // Allow only http/https URLs
      const parsed = new URL(u)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  })
}

const productSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 chars'),
  price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  stock: z.coerce.number().int().min(0, 'Stock must be 0 or greater'),
  category: z.enum(CATEGORIES),
  brand: z
    .string()
    .max(50, 'Brand must be 50 chars or less')
    .optional()
    .or(z.literal('')),
  thumbnail: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => {
        const s = (v ?? '').trim()
        if (!s) return true
        try {
          const u = new URL(s)
          return u.protocol === 'http:' || u.protocol === 'https:'
        } catch {
          return false
        }
      },
      { message: 'Invalid URL' }
    ),
  images: z.string().optional().default('').refine(isCsvOfUrls, {
    message: 'Images must be comma‑separated HTTP/HTTPS URLs',
  }),
  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description is too long')
    .optional()
    .or(z.literal('')),
  tags: z.string().optional().default(''),
})

export default function AdminNewProductPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      title: '',
      price: 0,
      stock: 0,
      category: CATEGORIES[0],
      brand: '',
      thumbnail: '',
      // Zod şeması bu iki alanı formda string olarak bekliyor (input text);
      // transform aşamasında string -> string[]'e çevrilecek.
      images: '',
      description: '',
      tags: '',
    },
  })

  async function onSubmit(values: ProductFormValues) {
    setSubmitting(true)
    try {
      const toArr = (s?: string) =>
        (s ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)

      const payload = {
        ...values,
        images: toArr(values.images),
        tags: toArr(values.tags),
      } as const

      const res = await fetch('/api/admin/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data: unknown = await res.json()

      if (!res.ok) {
        const msg =
          (typeof data === 'object' &&
            data &&
            'error' in data &&
            typeof (data as { error: string }).error === 'string' &&
            (data as { error: string }).error) ||
          'Failed to create product'
        alert(msg)
        return
      }

      // Başarılı → admin ürün listesine ya da anasayfaya yönlendir
      router.push('/admin/product')
    } catch (e) {
      console.error(e)
      alert('Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Add New Product</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Title</label>
          <input
            {...register('title')}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Product title"
          />
          {errors.title && (
            <p className="text-red-600 text-sm">{errors.title.message}</p>
          )}
        </div>

        {/* Price & Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-600 mb-1">
              Price (USD)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('price')}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="99.90"
            />
            {errors.price && (
              <p className="text-red-600 text-sm">{errors.price.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-1">Stock</label>
            <input
              type="number"
              {...register('stock')}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="10"
            />
            {errors.stock && (
              <p className="text-red-600 text-sm">{errors.stock.message}</p>
            )}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Category</label>
          <select
            {...register('category')}
            className="w-full rounded-xl border px-3 py-2 bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="text-red-600 text-sm">{errors.category.message}</p>
          )}
        </div>

        {/* Brand */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">Brand</label>
          <input
            {...register('brand')}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Apple"
          />
          {errors.brand && (
            <p className="text-red-600 text-sm">{errors.brand.message}</p>
          )}
        </div>

        {/* Thumbnail */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            Thumbnail URL
          </label>
          <input
            {...register('thumbnail')}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="https://..."
          />
          {errors.thumbnail && (
            <p className="text-red-600 text-sm">{errors.thumbnail.message}</p>
          )}
        </div>

        {/* Upload image (Vercel Blob) */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            Upload image
          </label>
          <div className="w-full rounded-xl border px-3 py-2 bg-white">
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              id="thumbnailFile"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files && e.target.files[0]
                if (!file) return
                setSelectedFileName(file.name)
                setUploading(true)
                try {
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
                } catch (err) {
                  console.error(err)
                } finally {
                  setUploading(false)
                }
              }}
            />

            {/* Trigger button + filename */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Choose image'}
              </button>
              <div className="text-xs text-zinc-600 truncate">
                {selectedFileName || 'No file selected'}
              </div>
            </div>
          </div>
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

        {/* Images */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            Images (comma separated URLs)
          </label>
          <input
            {...register('images')}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="https://... , https://..."
          />
          {errors.images && (
            <p className="text-red-600 text-sm">{errors.images.message}</p>
          )}
          {/* images dönüşümü transform ile string -> string[] yapıldığı için error olmayabilir */}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            Tags (comma separated)
          </label>
          <input
            {...register('tags')}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="new, sale"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            Description
          </label>
          <textarea
            {...register('description')}
            className="w-full rounded-xl border px-3 py-2 min-h-[100px]"
            placeholder="Short description..."
          />
          {errors.description && (
            <p className="text-red-600 text-sm">{errors.description.message}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save product'}
          </button>
          <Link href="/admin/product" className="rounded-xl border px-4 py-2">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
