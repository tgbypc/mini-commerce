'use client'

import { useState, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-hot-toast'
import { ArrowLeftCircle, Copy, Loader2, UploadCloud } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { PRIMARY_CATEGORY_SLUGS } from '@/lib/constants/categories'

const CATEGORY_OPTIONS = PRIMARY_CATEGORY_SLUGS

export type ProductFormValues = {
  title?: string
  title_en?: string
  title_nb?: string
  price: number
  stock: number
  category: string
  brand?: string
  thumbnail?: string
  images?: string
  description?: string
  description_en?: string
  description_nb?: string
  tags?: string
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
  category: z
    .string()
    .min(1, 'Category is required')
    .refine((value) => CATEGORY_OPTIONS.includes(value), {
      message: 'Category is not supported',
    }),
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
          const url = new URL(s)
          return url.protocol === 'http:' || url.protocol === 'https:'
        } catch {
          return false
        }
      },
      { message: 'Invalid URL' }
    ),
  images: z.string().optional().default('').refine(isCsvOfUrls, {
    message: 'Images must be comma-separated HTTP/HTTPS URLs',
  }),
  description: z.string().optional().or(z.literal('')),
  description_en: z.string().optional().or(z.literal('')),
  description_nb: z.string().optional().or(z.literal('')),
  tags: z.string().optional().default(''),
})

const inputClass =
  'w-full rounded-2xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.95)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[rgb(var(--admin-muted-rgb))] shadow-[0_8px_24px_-18px_rgba(15,23,42,0.18)] focus:border-blue-400/45 focus:outline-none focus:ring-0'
const textareaClass =
  'w-full rounded-2xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.95)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[rgb(var(--admin-muted-rgb))] shadow-[0_8px_24px_-18px_rgba(15,23,42,0.18)] focus:border-blue-400/45 focus:outline-none focus:ring-0 min-h-[140px]'
const selectClass =
  'w-full rounded-2xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.95)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-blue-400/45 focus:outline-none focus:ring-0'

function toCsvSet(value?: string) {
  const set = new Set(
    (value ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  )
  return Array.from(set)
}

export default function AdminNewProductPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeLocale, setActiveLocale] = useState<'en' | 'nb'>('en')

  const titleFieldByLocale: Record<'en' | 'nb', 'title_en' | 'title_nb'> = {
    en: 'title_en',
    nb: 'title_nb',
  }

  const descriptionFieldByLocale: Record<
    'en' | 'nb',
    'description_en' | 'description_nb'
  > = {
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
      category: CATEGORY_OPTIONS[0] ?? '',
      brand: '',
      thumbnail: '',
      images: '',
      description: '',
      description_en: '',
      description_nb: '',
      tags: '',
    },
  })

  const alternateLocale: 'en' | 'nb' = activeLocale === 'en' ? 'nb' : 'en'
  const localeCopyLabel = `Copy ${activeLocale.toUpperCase()} → ${alternateLocale.toUpperCase()}`
  const descriptionCopyLabel = `Copy description ${activeLocale.toUpperCase()} → ${alternateLocale.toUpperCase()}`

  async function refreshCatalog() {
    try {
      router.refresh()
    } catch {
      /* ignored */
    }
  }

  async function onSubmit(values: ProductFormValues) {
    setSubmitting(true)
    const toastId = toast.loading('Creating product…')
    try {
      const baseTitle = (values.title_en || values.title_nb || '').trim()
      if (!baseTitle || baseTitle.length < 3) {
        throw new Error('Please provide a localized title (min 3 characters).')
      }

      const payload = {
        title: baseTitle,
        title_en: values.title_en?.trim() || undefined,
        title_nb: values.title_nb?.trim() || undefined,
        price: Number(values.price),
        stock: Math.max(0, Number(values.stock) || 0),
        category: values.category,
        brand: values.brand?.trim() || undefined,
        thumbnail: values.thumbnail?.trim() || undefined,
        images: toCsvSet(values.images),
        description:
          (
            values.description_en ||
            values.description_nb ||
            values.description ||
            ''
          ).trim() || undefined,
        description_en: values.description_en?.trim() || undefined,
        description_nb: values.description_nb?.trim() || undefined,
        tags: toCsvSet(values.tags),
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

      if (!res.ok) {
        const message =
          (typeof data === 'object' &&
            data &&
            'error' in data &&
            typeof (data as { error: unknown }).error === 'string' &&
            (data as { error: string }).error) ||
          'Failed to create product'
        throw new Error(message)
      }

      toast.success('Product created successfully', { id: toastId })
      await refreshCatalog()
      router.push('/admin/product')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create product', {
        id: toastId,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 text-[rgb(var(--admin-text-rgb))]">
      <header className="admin-card admin-card--static rounded-3xl px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-blue-600/60">
            New product
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Launch a product listing
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--admin-muted-rgb))]">
            Capture localized titles, imagery, and inventory data to create a
            production-ready SKU for your e-commerce finals project.
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
          description="Content tabs let you keep English and Norwegian copy in sync."
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
              aria-label={`Copy ${activeLocale.toUpperCase()} content to ${alternateLocale.toUpperCase()}`}
              onClick={() => {
                const source = activeLocale
                const target = alternateLocale
                const srcField = titleFieldByLocale[source]
                const dstField = titleFieldByLocale[target]
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
              {localeCopyLabel}
            </button>
          </div>

          <div className="mt-4 space-y-6">
            <div>
              <Label>Title ({activeLocale.toUpperCase()})</Label>
              <input
                {...register('title_en')}
                className={`${inputClass} ${
                  activeLocale !== 'en' ? 'hidden' : ''
                }`}
                placeholder="English title"
              />
              <input
                {...register('title_nb')}
                className={`${inputClass} ${
                  activeLocale !== 'nb' ? 'hidden' : ''
                }`}
                placeholder="Norsk tittel"
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
                  aria-label={`Copy ${activeLocale.toUpperCase()} description to ${alternateLocale.toUpperCase()}`}
                  onClick={() => {
                    const source = activeLocale
                    const target = alternateLocale
                    const srcField = descriptionFieldByLocale[source]
                    const dstField = descriptionFieldByLocale[target]
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
                  {descriptionCopyLabel}
                </button>
              </div>
              <textarea
                {...register('description_en')}
                className={`${textareaClass} ${
                  activeLocale !== 'en' ? 'hidden' : ''
                }`}
                placeholder="English description"
              />
              <textarea
                {...register('description_nb')}
                className={`${textareaClass} ${
                  activeLocale !== 'nb' ? 'hidden' : ''
                }`}
                placeholder="Beskrivelse (norsk)"
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Pricing & inventory"
          description="Keep numbers accurate — your clients will test them during demos."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t('admin.price')} (USD)</Label>
              <input
                type="number"
                step="0.01"
                {...register('price')}
                className={inputClass}
                placeholder="99.90"
              />
              {errors.price && (
                <ErrorMessage>{errors.price.message}</ErrorMessage>
              )}
            </div>
            <div>
              <Label>{t('admin.stock')}</Label>
              <input
                type="number"
                {...register('stock')}
                className={inputClass}
                placeholder="10"
              />
              {errors.stock && (
                <ErrorMessage>{errors.stock.message}</ErrorMessage>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t('admin.category')}</Label>
              <select {...register('category')} className={selectClass}>
                {CATEGORY_OPTIONS.map((category) => {
                  const key = `cat.${category}`
                  const label = t(key)
                  const displayLabel = label && label !== key ? label : category
                  return (
                    <option key={category} value={category}>
                      {displayLabel}
                    </option>
                  )
                })}
              </select>
              {errors.category && (
                <ErrorMessage>{errors.category.message}</ErrorMessage>
              )}
            </div>
            <div>
              <Label>{t('admin.brand')}</Label>
              <input
                {...register('brand')}
                className={inputClass}
                placeholder="Apple"
              />
              {errors.brand && (
                <ErrorMessage>{errors.brand.message}</ErrorMessage>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Media & merchandising"
          description="Upload through Vercel Blob or paste URLs for deterministic demos."
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <div>
                <Label>{t('admin.thumbnailUrl')}</Label>
                <input
                  {...register('thumbnail')}
                  className={inputClass}
                  placeholder="https://..."
                />
                {errors.thumbnail && (
                  <ErrorMessage>{errors.thumbnail.message}</ErrorMessage>
                )}
              </div>

              <div>
                <Label>{t('admin.imagesCsv')}</Label>
                <input
                  {...register('images')}
                  className={inputClass}
                  placeholder="https://..., https://..."
                />
                {errors.images && (
                  <ErrorMessage>{errors.images.message}</ErrorMessage>
                )}
              </div>

              <div>
                <Label>{t('admin.tagsCsv')}</Label>
                <input
                  {...register('tags')}
                  className={inputClass}
                  placeholder="new, sale"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-3xl admin-card admin-card--static p-4">
              <Label>{t('admin.uploadImage')}</Label>
              <div className="rounded-2xl admin-card-soft p-4 text-sm text-[rgb(var(--admin-muted-rgb))]">
                <input
                  ref={fileInputRef}
                  id="thumbnailFile"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (event) => {
                    const file = event.target.files && event.target.files[0]
                    if (!file) return
                    setSelectedFileName(file.name)
                    setUploading(true)
                    try {
                      const token = await user
                        ?.getIdToken()
                        .catch(() => undefined)
                      if (!token) {
                        throw new Error('Failed to verify admin identity')
                      }
                      const formData = new FormData()
                      formData.append('file', file)
                      const res = await fetch('/api/admin/upload', {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                        body: formData,
                      })
                      if (!res.ok) {
                        throw new Error('Upload failed')
                      }
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
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2
                        className="size-4 animate-spin"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <UploadCloud className="size-4" strokeWidth={1.75} />
                    )}
                    {uploading ? t('admin.saving') : t('admin.chooseImage')}
                  </button>
                  <div className="truncate text-xs text-[rgb(var(--admin-muted-rgb))]">
                    {selectedFileName || t('admin.noFile')}
                  </div>
                </div>
              </div>

              {watch('thumbnail') ? (
                <div className="relative h-40 w-full overflow-hidden rounded-2xl border admin-border">
                  <Image
                    src={watch('thumbnail')!}
                    alt="Preview"
                    fill
                    sizes="300px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : null}
            </div>
          </div>
        </FormSection>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/35 bg-blue-500/15 px-6 py-2 text-sm font-semibold text-blue-700 shadow-[0_18px_35px_-20px_rgba(59,130,246,0.45)] transition hover:border-blue-500/55 hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            ) : null}
            {submitting ? t('admin.saving') : 'Save product'}
          </button>
          <Link
            href="/admin/product"
            className="inline-flex items-center justify-center gap-2 rounded-xl border admin-border bg-[rgb(var(--admin-surface-soft-rgb)/0.92)] px-6 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-blue-400/35 hover:bg-blue-500/12"
          >
            Cancel
          </Link>
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
    <section className="rounded-3xl admin-surface admin-surface--static p-6 shadow-[0_18px_40px_-35px_rgba(59,130,246,0.22)]">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-[rgb(var(--admin-muted-rgb))]">
          {description}
        </p>
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
  return <p className="mt-1 text-xs font-medium text-rose-600">{children}</p>
}
