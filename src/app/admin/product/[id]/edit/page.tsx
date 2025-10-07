'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import {
  ArrowLeftCircle,
  Copy,
  Loader2,
  UploadCloud,
} from 'lucide-react'
import { useI18n } from '@/context/I18nContext'
import { getProductById } from '@/lib/products'
import type { Product } from '@/types/product'
import { CATEGORIES } from '@/lib/constants/categories'
import type { Category } from '@/lib/constants/categories'
import { useAuth } from '@/context/AuthContext'

const schema = z.object({
  title: z.string().optional().or(z.literal('')),
  title_en: z.string().optional().or(z.literal('')),
  title_nb: z.string().optional().or(z.literal('')),
  price: z.coerce.number().nonnegative('Price cannot be negative'),
  stock: z.coerce
    .number()
    .int()
    .min(0, 'Stock must be zero or greater')
    .optional(),
  category: z.enum(CATEGORIES),
  brand: z.string().max(50).optional().or(z.literal('')),
  thumbnail: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  images: z.string().transform((s) => s.trim()).optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  description_en: z.string().optional().or(z.literal('')),
  description_nb: z.string().optional().or(z.literal('')),
  tags: z.string().transform((s) => s.trim()).optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>
type LocaleCode = 'en' | 'nb'

const inputClass =
  'w-full rounded-2xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.95)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[rgb(var(--admin-muted-rgb))] shadow-[0_8px_24px_-18px_rgba(15,23,42,0.18)] focus:border-blue-400/45 focus:outline-none focus:ring-0'
const textareaClass =
  'w-full rounded-2xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.95)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[rgb(var(--admin-muted-rgb))] shadow-[0_8px_24px_-18px_rgba(15,23,42,0.18)] focus:border-blue-400/45 focus:outline-none focus:ring-0 min-h-[140px]'
const selectClass =
  'w-full rounded-2xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.95)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-blue-400/45 focus:outline-none focus:ring-0'

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

function toCsv(value?: string) {
  return toSet(value).join(', ')
}

function toSet(value?: string) {
  return Array.from(
    new Set(
      (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

export default function EditProductPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [initial, setInitial] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeLocale, setActiveLocale] = useState<LocaleCode>('en')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

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
        setLoading(true)
        const product = await getProductById(String(id))
        if (!alive) return
        if (!product) {
          setError('Product not found')
          return
        }
        setInitial(product)
        reset({
          title: product.title,
          title_en: product.title_en ?? product.title,
          title_nb: product.title_nb ?? '',
          price: Number(product.price) || 0,
          stock: typeof product.stock === 'number' ? product.stock : 0,
          category: (product.category as Category) ?? CATEGORIES[0],
          brand: product.brand ?? '',
          thumbnail:
            typeof product.thumbnail === 'string'
              ? product.thumbnail
              : typeof (product as { image?: string }).image === 'string'
              ? (product as { image?: string }).image
              : '',
          images: toCsv(
            Array.isArray((product as { images?: string[] }).images)
              ? ((product as { images?: string[] }).images || []).join(', ')
              : ''
          ),
          description: product.description ?? '',
          description_en: product.description_en ?? product.description ?? '',
          description_nb: product.description_nb ?? '',
          tags: toCsv(
            Array.isArray((product as { tags?: string[] }).tags)
              ? ((product as { tags?: string[] }).tags || []).join(', ')
              : ''
          ),
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
    const toastId = toast.loading('Updating product…')
    try {
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
        images: toSet(values.images),
        tags: toSet(values.tags),
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
        const message = (data && data.error) || 'Update failed'
        throw new Error(message)
      }
      toast.success('Product updated', { id: toastId })
      router.push('/admin/product')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed', {
        id: toastId,
      })
    }
  }

  const title = useMemo(
    () => (initial ? `Edit: ${initial.title}` : 'Edit product'),
    [initial]
  )

  if (loading) {
    return (
      <div className="admin-card space-y-4 rounded-3xl p-6">
        <div className="h-7 w-64 rounded bg-[rgba(var(--admin-border-rgb),0.12)]" />
        <div className="h-10 w-full rounded bg-[rgba(var(--admin-border-rgb),0.08)]" />
        <div className="h-10 w-full rounded bg-[rgba(var(--admin-border-rgb),0.08)]" />
        <div className="h-24 w-full rounded bg-[rgba(var(--admin-border-rgb),0.08)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-400/40 bg-rose-500/12 p-6 text-sm text-rose-700">
        {error}
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="admin-card rounded-3xl p-6 text-sm text-[rgb(var(--admin-muted-rgb))]">
        Product not found.
      </div>
    )
  }

  return (
    <div className="space-y-8 text-[rgb(var(--admin-text-rgb))]">
      <header className="admin-card rounded-3xl px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-blue-600/60">
            Edit product
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--admin-muted-rgb))]">
            Update localized content, pricing, and media. Changes sync to the
            storefront instantly.
          </p>
        </div>
        <Link
          href="/admin/product"
          className="inline-flex items-center gap-2 rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12"
        >
          <ArrowLeftCircle className="size-4" strokeWidth={1.75} />
          Back to catalog
        </Link>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormSection
          title="Localized content"
          description="Ensure both locales stay aligned before go-live."
        >
          <div className="flex flex-wrap items-center gap-3">
            {(['en', 'nb'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setActiveLocale(loc)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] transition ${
                  activeLocale === loc
                    ? 'border border-blue-400/55 bg-blue-500/20 text-blue-700 shadow-[0_6px_18px_-8px_rgba(59,130,246,0.45)]'
                    : 'border border-blue-400/20 bg-blue-500/8 text-blue-600 hover:border-blue-400/35 hover:bg-blue-500/15'
                }`}
              >
                {loc.toUpperCase()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const source = activeLocale
                const target = source === 'en' ? 'nb' : 'en'
                const srcField = TITLE_FIELD_BY_LOCALE[source]
                const dstField = TITLE_FIELD_BY_LOCALE[target]
                const value = watch(srcField) || ''
                if (!value.trim()) {
                  toast.error('Nothing to copy — add content first.')
                  return
                }
                setValue(dstField, value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
                setActiveLocale(target)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 transition hover:border-blue-400/35 hover:bg-blue-500/15"
            >
              <Copy className="size-3.5" strokeWidth={1.75} />
              Copy locale
            </button>
          </div>

          <div className="mt-4 space-y-6">
            <div>
              <Label>
                {t('admin.localeTitle').replace(
                  '{loc}',
                  activeLocale.toUpperCase()
                )}
              </Label>
              <input
                {...register('title_en')}
                className={`${inputClass} ${activeLocale !== 'en' ? 'hidden' : ''}`}
              />
              <input
                {...register('title_nb')}
                className={`${inputClass} ${activeLocale !== 'nb' ? 'hidden' : ''}`}
              />
            </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>
              {t('admin.localeDescription').replace(
                '{loc}',
                activeLocale.toUpperCase()
              )}
            </Label>
            <button
              type="button"
              onClick={() => {
                const source: LocaleCode = activeLocale
                const target: LocaleCode = source === 'en' ? 'nb' : 'en'
                const srcField = DESCRIPTION_FIELD_BY_LOCALE[source]
                const dstField = DESCRIPTION_FIELD_BY_LOCALE[target]
                const value = watch(srcField) || ''
                if (!value.trim()) {
                  toast.error('Nothing to copy — add content first.')
                  return
                }
                setValue(dstField, value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
                setActiveLocale(target)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600 transition hover:border-blue-400/35 hover:bg-blue-500/15"
            >
              <Copy className="size-3" strokeWidth={1.75} />
              Copy description
            </button>
          </div>
          <textarea
            {...register('description_en')}
            className={`${textareaClass} ${
              activeLocale !== 'en' ? 'hidden' : ''
            }`}
              />
              <textarea
                {...register('description_nb')}
                className={`${textareaClass} ${
                  activeLocale !== 'nb' ? 'hidden' : ''
                }`}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Pricing & inventory"
          description="Keep these values aligned with your live storefront."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t('admin.price')}</Label>
              <input type="number" step="0.01" {...register('price')} className={inputClass} />
              {errors.price && <ErrorMessage>{errors.price.message}</ErrorMessage>}
            </div>
            <div>
              <Label>{t('admin.stock')}</Label>
              <input type="number" {...register('stock')} className={inputClass} />
              {errors.stock && <ErrorMessage>{errors.stock.message}</ErrorMessage>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t('admin.category')}</Label>
              <select {...register('category')} className={selectClass}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category && (
                <ErrorMessage>{errors.category.message}</ErrorMessage>
              )}
            </div>
            <div>
              <Label>{t('admin.brand')}</Label>
              <input {...register('brand')} className={inputClass} />
              {errors.brand && <ErrorMessage>{errors.brand.message}</ErrorMessage>}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Media & merchandising"
          description="Update hero imagery and marketing tags."
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <div>
                <Label>Thumbnail (URL)</Label>
                <input {...register('thumbnail')} className={inputClass} />
                {errors.thumbnail && (
                  <ErrorMessage>{errors.thumbnail.message}</ErrorMessage>
                )}
              </div>

              <div>
                <Label>Images (comma separated URLs)</Label>
                <input {...register('images')} className={inputClass} />
                {errors.images && <ErrorMessage>{errors.images.message}</ErrorMessage>}
              </div>

              <div>
                <Label>Tags (comma separated)</Label>
                <input {...register('tags')} className={inputClass} />
              </div>
            </div>

        <div className="space-y-3 rounded-3xl admin-card p-4">
          <Label>Upload image</Label>
          <div className="rounded-2xl admin-card-soft p-4 text-sm text-[rgb(var(--admin-muted-rgb))]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (event) => {
                    const file = event.target.files && event.target.files[0]
                    if (!file) return
                    setUploading(true)
                    try {
                      const token = await user?.getIdToken().catch(() => undefined)
                      if (!token) throw new Error('Failed to obtain admin token')
                      const formData = new FormData()
                      formData.append('file', file)
                      const res = await fetch('/api/admin/upload', {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                        body: formData,
                      })
                      if (!res.ok) throw new Error('Upload failed')
                      const data = (await res.json()) as { url: string }
                      setValue('thumbnail', data.url, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      toast.success('Image uploaded and linked')
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : 'Upload failed'
                      )
                    } finally {
                      setUploading(false)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <UploadCloud className="size-4" strokeWidth={1.75} />
                  )}
                  {uploading ? t('admin.saving') : t('admin.chooseImage')}
                </button>
              </div>
              {watch('thumbnail') ? (
                <div className="relative h-40 w-full overflow-hidden rounded-2xl border admin-border">
                  <Image
                    src={watch('thumbnail')!}
                    alt="Preview"
                    fill
                    sizes="300px"
                    className="object-cover"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </FormSection>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/35 bg-blue-500/15 px-6 py-2 text-sm font-semibold text-blue-700 shadow-[0_18px_35px_-20px_rgba(59,130,246,0.45)] transition hover:border-blue-500/55 hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            ) : null}
            {isSubmitting ? t('admin.saving') : t('admin.saveChanges')}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/product')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-6 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12"
          >
            {t('admin.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl admin-card p-6 shadow-[0_18px_40px_-35px_rgba(59,130,246,0.22)]">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">{description}</p>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-blue-600/60">
      {children}
    </label>
  )
}

function ErrorMessage({ children }: { children?: string }) {
  if (!children) return null
  return (
    <p className="mt-1 text-xs font-medium text-rose-600">
      {children}
    </p>
  )
}
