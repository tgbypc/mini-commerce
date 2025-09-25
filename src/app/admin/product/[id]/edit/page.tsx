'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { useI18n } from '@/context/I18nContext'
import { zodResolver } from '@hookform/resolvers/zod'
// Firestore update is handled by API; keep only types/helpers if needed
import { getProductById } from '@/lib/products'
import type { Product } from '@/types/product'
import { CATEGORIES } from '@/lib/constants/categories'
import type { Category } from '@/lib/constants/categories'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'

const schema = z.object({
  title: z.string().optional().or(z.literal('')),
  title_en: z.string().optional().or(z.literal('')),
  title_nb: z.string().optional().or(z.literal('')),
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
  description: z.string().optional().or(z.literal('')),
  description_en: z.string().optional().or(z.literal('')),
  description_nb: z.string().optional().or(z.literal('')),
  tags: z
    .string()
    .transform((s) => s.trim())
    .optional()
    .or(z.literal('')),
})

type FormValues = z.infer<typeof schema>
type LocaleCode = 'en' | 'nb'

const TITLE_FIELD_BY_LOCALE: Record<LocaleCode, 'title_en' | 'title_nb'> = {
  en: 'title_en',
  nb: 'title_nb',
}

const DESCRIPTION_FIELD_BY_LOCALE: Record<
  LocaleCode,
  'description_en' | 'description_nb'
> = {
  en: 'description_en',
  nb: 'description_nb',
}

export default function EditProductPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [initial, setInitial] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeLocale, setActiveLocale] = useState<'en' | 'nb'>('en')

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

        reset({
          title: p.title,
          title_en: p.title_en ?? p.title,
          title_nb: p.title_nb ?? '',
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
          description_en: p.description_en ?? p.description ?? '',
          description_nb: p.description_nb ?? '',
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

    const toArr = (s?: string) =>
      Array.from(
        new Set(
          (s ?? '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        )
      )

    const payload = {
      id: String(initial.id),
      title: values.title?.trim() || '',
      title_en: values.title_en?.trim() || undefined,
      title_nb: values.title_nb?.trim() || undefined,
      description: values.description?.trim() || undefined,
      description_en: values.description_en?.trim() || undefined,
      description_nb: values.description_nb?.trim() || undefined,
      price: Number(values.price) || 0,
      stock: Math.max(0, Number(values.stock) || 0),
      category: values.category,
      brand: values.brand?.trim() || undefined,
      thumbnail: values.thumbnail?.trim() || undefined,
      images: toArr(values.images),
      tags: toArr(values.tags),
    } as const

    const token = await user?.getIdToken().catch(() => undefined)
    const res = await fetch('/api/admin/product', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Update failed')
    }

    router.push('/admin/product')
    router.refresh()
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
        {/* Base title removed; use localized fields below */}

        <div className="inline-flex gap-2 rounded-lg bg-zinc-100 p-1">
          {(['en', 'nb'] as const).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setActiveLocale(loc)}
              className={`px-3 py-1 text-sm rounded ${
                activeLocale === loc ? 'bg-white border' : ''
              }`}
            >
              {loc.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const sourceLocale: LocaleCode = activeLocale
              const targetLocale: LocaleCode =
                sourceLocale === 'en' ? 'nb' : 'en'
              const srcField = TITLE_FIELD_BY_LOCALE[sourceLocale]
              const dstField = TITLE_FIELD_BY_LOCALE[targetLocale]
              const val = watch(srcField) || ''
              if (!val.trim()) return
              setValue(dstField, val, {
                shouldDirty: true,
                shouldValidate: true,
              })
              setActiveLocale(targetLocale)
            }}
            className="ml-2 text-xs rounded border px-2"
          >
            {t('admin.copyTo').replace(
              '{loc}',
              activeLocale === 'en' ? 'NB' : 'EN'
            )}
          </button>
        </div>

        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            {t('admin.localeTitle').replace(
              '{loc}',
              activeLocale.toUpperCase()
            )}
          </label>
          <input
            {...register('title_en')}
            className={`w-full rounded-lg border px-3 py-2 ${
              activeLocale !== 'en' ? 'hidden' : ''
            }`}
          />
          <input
            {...register('title_nb')}
            className={`w-full rounded-lg border px-3 py-2 ${
              activeLocale !== 'nb' ? 'hidden' : ''
            }`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm text-zinc-600 mb-1">
              {t('admin.price')}
            </span>
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
            <span className="block text-sm text-zinc-600 mb-1">
              {t('admin.stock')}
            </span>
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
          <span className="block text-sm text-zinc-600 mb-1">
            {t('admin.category')}
          </span>
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
          <span className="block text-sm text-zinc-600 mb-1">
            {t('admin.brand')}
          </span>
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
              const token = await user?.getIdToken().catch(() => undefined)
              if (!token) {
                console.error('Upload blocked: admin token alınamadı')
                return
              }
              const fd = new FormData()
              fd.append('file', file)
              const res = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
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

        {/* Base description removed; use localized fields below */}

        <div className="inline-flex gap-2 rounded-lg bg-zinc-100 p-1">
          {(['en', 'nb'] as const).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setActiveLocale(loc)}
              className={`px-3 py-1 text-sm rounded ${
                activeLocale === loc ? 'bg-white border' : ''
              }`}
            >
              {loc.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const sourceLocale: LocaleCode = activeLocale
              const targetLocale: LocaleCode =
                sourceLocale === 'en' ? 'nb' : 'en'
              const srcField = DESCRIPTION_FIELD_BY_LOCALE[sourceLocale]
              const dstField = DESCRIPTION_FIELD_BY_LOCALE[targetLocale]
              const val = watch(srcField) || ''
              if (!val.trim()) return
              setValue(dstField, val, {
                shouldDirty: true,
                shouldValidate: true,
              })
              setActiveLocale(targetLocale)
            }}
            className="ml-2 text-xs rounded border px-2"
          >
            {t('admin.copyTo').replace(
              '{loc}',
              activeLocale === 'en' ? 'NB' : 'EN'
            )}
          </button>
        </div>

        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            {t('admin.localeDescription').replace(
              '{loc}',
              activeLocale.toUpperCase()
            )}
          </label>
          <textarea
            {...register('description_en')}
            rows={4}
            className={`w-full rounded-lg border px-3 py-2 ${
              activeLocale !== 'en' ? 'hidden' : ''
            }`}
          />
          <textarea
            {...register('description_nb')}
            rows={4}
            className={`w-full rounded-lg border px-3 py-2 ${
              activeLocale !== 'nb' ? 'hidden' : ''
            }`}
          />
        </div>

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
            {isSubmitting ? t('admin.saving') : t('admin.saveChanges')}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/product')}
            className="rounded-xl border px-4 py-2"
          >
            {t('admin.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
