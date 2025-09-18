'use client'

import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

import { CATEGORIES } from '@/lib/constants/categories'
import type { Category } from '@/lib/constants/categories'

// Strongly-typed form values used by RHF
export type ProductFormValues = {
  title?: string
  title_en?: string
  title_nb?: string
  price: number
  stock: number
  category: Category
  brand?: string
  thumbnail?: string
  images?: string // comma-separated in UI; we convert to string[] before sending
  description?: string
  description_en?: string
  description_nb?: string
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
  title: z.string().optional().or(z.literal('')),
  title_en: z.string().optional().or(z.literal('')),
  title_nb: z.string().optional().or(z.literal('')),
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
  description: z.string().optional().or(z.literal('')),
  description_en: z.string().optional().or(z.literal('')),
  description_nb: z.string().optional().or(z.literal('')),
  tags: z.string().optional().default(''),
})

export default function AdminNewProductPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeLocale, setActiveLocale] = useState<'en' | 'nb'>('en')
  const titleFieldByLocale: Record<typeof activeLocale, 'title_en' | 'title_nb'> = {
    en: 'title_en',
    nb: 'title_nb',
  }
  const descriptionFieldByLocale: Record<typeof activeLocale, 'description_en' | 'description_nb'> = {
    en: 'description_en',
    nb: 'description_nb',
  }

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
      title_en: '',
      title_nb: '',
      price: 0,
      stock: 0,
      category: CATEGORIES[0],
      brand: '',
      thumbnail: '',
      // Zod şeması bu iki alanı formda string olarak bekliyor (input text);
      // transform aşamasında string -> string[]'e çevrilecek.
      images: '',
      description: '',
      description_en: '',
      description_nb: '',
      tags: '',
    },
  })

  async function onSubmit(values: ProductFormValues) {
    setSubmitting(true)
    try {
      // Require at least one localized title
      const baseTitle = (values.title_en || values.title_nb || '').trim()
      if (!baseTitle || baseTitle.length < 3) {
        alert('Please provide a title in EN or NB (min 3 chars).')
        return
      }
      const toArr = (s?: string) => {
        const set = new Set(
          (s ?? '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        )
        return Array.from(set)
      }

      const payload = {
        title: baseTitle, // set base for fallback/search
        title_en: values.title_en?.trim() || undefined,
        title_nb: values.title_nb?.trim() || undefined,
        price: Number(values.price),
        stock: Math.max(0, Number(values.stock) || 0),
        category: values.category,
        brand: values.brand?.trim() || undefined,
        thumbnail: values.thumbnail?.trim() || undefined,
        images: toArr(values.images),
        description: (values.description_en || values.description_nb || values.description || '').trim() || undefined,
        description_en: values.description_en?.trim() || undefined,
        description_nb: values.description_nb?.trim() || undefined,
        tags: toArr(values.tags),
      } as const

      const token = await user?.getIdToken().catch(() => undefined)
      const res = await fetch('/api/admin/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const data: unknown = await res.json()

      // Optional: if API returns created product doc id
      const createdId =
        typeof data === 'object' && data && 'id' in data
          ? (data as { id?: string }).id
          : undefined

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

      if (createdId) {
        // no-op: you could route to `/admin/product/${createdId}/edit` if desired
      }
      // refresh list after redirect
      router.refresh()

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
      <h1 className="text-2xl font-semibold mb-4">{t('admin.products')}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Localized Title with tabs */}
        <div>
          <div className="mb-2 inline-flex gap-2 rounded-lg bg-zinc-100 p-1">
            {(['en', 'nb'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setActiveLocale(loc)}
                className={`px-3 py-1 text-sm rounded ${activeLocale === loc ? 'bg-white border' : ''}`}
              >
                {loc.toUpperCase()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const sourceLocale = activeLocale
                const targetLocale = sourceLocale === 'en' ? 'nb' : 'en'
                const srcField = titleFieldByLocale[sourceLocale]
                const dstField = titleFieldByLocale[targetLocale]
                const val = watch(srcField) || ''
                if (!val.trim()) return
                setValue(dstField, val, { shouldDirty: true, shouldValidate: true })
                setActiveLocale(targetLocale)
              }}
              className="ml-2 text-xs rounded border px-2"
            >
              {t('admin.copyTo').replace('{loc}', activeLocale === 'en' ? 'NB' : 'EN')}
            </button>
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-1">Title ({activeLocale.toUpperCase()})</label>
            <input
              {...register('title_en')}
              className={`w-full rounded-xl border px-3 py-2 ${activeLocale !== 'en' ? 'hidden' : ''}`}
              placeholder="English title"
            />
            <input
              {...register('title_nb')}
              className={`w-full rounded-xl border px-3 py-2 ${activeLocale !== 'nb' ? 'hidden' : ''}`}
              placeholder="Norsk tittel"
            />
            {/* Title validation handled at submit across locales */}
          </div>
        </div>

        {/* Price & Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-600 mb-1">{t('admin.price')} (USD)</label>
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
            <label className="block text-sm text-zinc-600 mb-1">{t('admin.stock')}</label>
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
          <label className="block text-sm text-zinc-600 mb-1">{t('admin.category')}</label>
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
          <label className="block text-sm text-zinc-600 mb-1">{t('admin.brand')}</label>
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
          <label className="block text-sm text-zinc-600 mb-1">{t('admin.thumbnailUrl')}</label>
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
            {t('admin.uploadImage')}
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
                {uploading ? t('admin.saving') : t('admin.chooseImage')}
              </button>
              <div className="text-xs text-zinc-600 truncate">
                {selectedFileName || t('admin.noFile')}
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
                unoptimized
              />
            </div>
          ) : null}
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm text-zinc-600 mb-1">{t('admin.imagesCsv')}</label>
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
          <label className="block text-sm text-zinc-600 mb-1">{t('admin.tagsCsv')}</label>
          <input
            {...register('tags')}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="new, sale"
          />
        </div>

        {/* Localized Description with tabs */}
        <div>
          <div className="mb-2 inline-flex gap-2 rounded-lg bg-zinc-100 p-1">
            {(['en', 'nb'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setActiveLocale(loc)}
                className={`px-3 py-1 text-sm rounded ${activeLocale === loc ? 'bg-white border' : ''}`}
              >
                {loc.toUpperCase()}
              </button>
            ))}
          <button
            type="button"
            onClick={() => {
              const sourceLocale = activeLocale
              const targetLocale = sourceLocale === 'en' ? 'nb' : 'en'
              const srcField = descriptionFieldByLocale[sourceLocale]
              const dstField = descriptionFieldByLocale[targetLocale]
              const val = watch(srcField) || ''
              if (!val.trim()) return
              setValue(dstField, val, { shouldDirty: true, shouldValidate: true })
              setActiveLocale(targetLocale)
            }}
              className="ml-2 text-xs rounded border px-2"
            >
              {t('admin.copyTo').replace('{loc}', activeLocale === 'en' ? 'NB' : 'EN')}
            </button>
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-1">{t('admin.localeDescription').replace('{loc}', activeLocale.toUpperCase())}</label>
            <textarea
              {...register('description_en')}
              className={`w-full rounded-xl border px-3 py-2 min-h-[100px] ${activeLocale !== 'en' ? 'hidden' : ''}`}
              placeholder="English description"
            />
            <textarea
              {...register('description_nb')}
              className={`w-full rounded-xl border px-3 py-2 min-h-[100px] ${activeLocale !== 'nb' ? 'hidden' : ''}`}
              placeholder="Beskrivelse (norsk)"
            />
          </div>
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
