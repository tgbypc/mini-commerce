'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { useParams, useRouter } from 'next/navigation'
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { ArrowLeftCircle, Copy, Loader2, UploadCloud } from 'lucide-react'
import { useI18n } from '@/context/I18nContext'
import { getProductById } from '@/lib/products'
import type { Product } from '@/types/product'
import { PRIMARY_CATEGORY_SLUGS } from '@/lib/constants/categories'
import { useAuth } from '@/context/AuthContext'

const CATEGORY_OPTIONS = PRIMARY_CATEGORY_SLUGS

const HERO_SURFACE_CLASS =
  'rounded-4xl border border-zinc-200 bg-white/95 shadow-[0_32px_56px_-30px_rgba(15,23,42,0.28)] dark:border-zinc-700 dark:bg-[#111827]'
const SURFACE_CARD_CLASS =
  'w-full rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_26px_52px_-32px_rgba(15,23,42,0.22)] transition-transform duration-200 backdrop-blur dark:border-zinc-700 dark:bg-[#0f172a]/80'
const PRIMARY_BUTTON_CLASS =
  'btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60'
const OUTLINE_BUTTON_CLASS =
  'btn-outline gap-2 disabled:cursor-not-allowed disabled:opacity-60'

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
  category: z.string().min(1, 'Category is required'),
  brand: z.string().max(50).optional().or(z.literal('')),
  thumbnail: z.string().url('Must be a valid URL').optional().or(z.literal('')),
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

const FIELD_BASE_CLASS =
  'w-full rounded-2xl border border-zinc-200 bg-white/90 px-4 py-2 text-sm text-[#0d141c] shadow-sm transition focus:border-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20 dark:border-zinc-700 dark:bg-[#0f172a]/80 dark:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60'
const inputClass = FIELD_BASE_CLASS
const textareaClass = `${FIELD_BASE_CLASS} min-h-[140px]`
const selectClass = FIELD_BASE_CLASS
const pillButtonClass =
  'inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/85 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#4338ca] transition hover:-translate-y-0.5 hover:border-[#4338ca]/40 hover:bg-[#4338ca]/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-100 dark:hover:border-[#6366f1]/45 dark:hover:bg-[#4338ca]/20'

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
  const categoryOptions = useMemo(() => {
    const base = [...CATEGORY_OPTIONS]
    const trimmed = initial?.category?.trim()
    if (trimmed) {
      const lowerBase = CATEGORY_OPTIONS.map((option) => option.toLowerCase())
      if (!lowerBase.includes(trimmed.toLowerCase())) {
        base.push(trimmed)
      }
    }
    return base
  }, [initial?.category])

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
          category:
            (typeof product.category === 'string' && product.category.trim()) ||
            CATEGORY_OPTIONS[0] ||
            '',
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

  const alternateLocale: LocaleCode = activeLocale === 'en' ? 'nb' : 'en'
  const localeCopyLabel = `Copy ${activeLocale.toUpperCase()} → ${alternateLocale.toUpperCase()}`
  const descriptionCopyLabel = `Copy description ${activeLocale.toUpperCase()} → ${alternateLocale.toUpperCase()}`

  if (loading) {
    return (
      <div className="relative overflow-hidden bg-[#f6f7fb] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto w-full max-w-5xl">
          <div className={`${SURFACE_CARD_CLASS} space-y-4 rounded-3xl p-6`}>
            <div className="h-7 w-64 rounded bg-zinc-200/70 dark:bg-zinc-700/70" />
            <div className="h-10 w-full rounded bg-zinc-200/60 dark:bg-zinc-700/60" />
            <div className="h-10 w-full rounded bg-zinc-200/60 dark:bg-zinc-700/60" />
            <div className="h-24 w-full rounded bg-zinc-200/50 dark:bg-zinc-700/50" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="relative overflow-hidden bg-[#f6f7fb] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto w-full max-w-5xl">
          <div className="rounded-4xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600 shadow-[0_26px_52px_-32px_rgba(244,63,94,0.25)] dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="relative overflow-hidden bg-[#f6f7fb] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto w-full max-w-5xl">
          <div className={`${SURFACE_CARD_CLASS} rounded-3xl p-6 text-sm text-zinc-600 dark:text-zinc-300`}>
            Product not found.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-[#f6f7fb] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <span
        className="pointer-events-none absolute -left-[20%] top-16 size-[320px] rounded-full bg-[rgba(124,58,237,0.14)] blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-10 right-[-24%] size-[360px] rounded-full bg-[rgba(59,130,246,0.12)] blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 text-[#0d141c] dark:text-white">
        <section
          className={`relative overflow-hidden ${HERO_SURFACE_CLASS} px-6 py-10 sm:px-10`}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-[-22%] hidden w-[52%] rounded-full bg-gradient-to-br from-[#dbe7ff] via-transparent to-transparent blur-3xl sm:block"
            aria-hidden
          />
          <div className="relative z-[1] flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f6f7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:border-zinc-700 dark:bg-[#101828] dark:text-zinc-400">
                Catalog editor
              </span>
              <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
              <p className="max-w-2xl text-sm text-zinc-600 md:text-base dark:text-zinc-300">
                Update localized content, pricing, and media with an interface
                inspired by the admin messages workspace.
              </p>
            </div>
            <Link href="/admin/product" className={OUTLINE_BUTTON_CLASS}>
              <ArrowLeftCircle className="size-4" strokeWidth={1.75} />
              Back to catalog
            </Link>
          </div>
        </section>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
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
                  className={clsx(
                    'rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] transition',
                    activeLocale === loc
                      ? 'border-[#4338ca] bg-[#4338ca]/15 text-[#4338ca] shadow-[0_6px_18px_-8px_rgba(67,56,202,0.45)]'
                      : 'border-zinc-200 bg-white/85 text-zinc-600 hover:border-[#4338ca]/35 hover:bg-[#4338ca]/10 dark:border-zinc-700 dark:bg-[#0f172a]/70 dark:text-zinc-300 dark:hover:border-[#6366f1]/45 dark:hover:bg-[#4338ca]/20'
                  )}
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
                className={pillButtonClass}
              >
                <Copy className="size-3.5" strokeWidth={1.75} />
                {localeCopyLabel}
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
                  className={clsx(inputClass, activeLocale !== 'en' && 'hidden')}
                />
                <input
                  {...register('title_nb')}
                  className={clsx(inputClass, activeLocale !== 'nb' && 'hidden')}
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                      const source: LocaleCode = activeLocale
                      const target: LocaleCode = alternateLocale
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
                    className={clsx(pillButtonClass, 'text-[11px]')}
                  >
                    <Copy className="size-3" strokeWidth={1.75} />
                    {descriptionCopyLabel}
                  </button>
                </div>
                <textarea
                  {...register('description_en')}
                  className={clsx(
                    textareaClass,
                    activeLocale !== 'en' && 'hidden'
                  )}
                />
                <textarea
                  {...register('description_nb')}
                  className={clsx(
                    textareaClass,
                    activeLocale !== 'nb' && 'hidden'
                  )}
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
                <input
                  type="number"
                  step="0.01"
                  {...register('price')}
                  className={inputClass}
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
                  {categoryOptions.map((category) => {
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
                <input {...register('brand')} className={inputClass} />
                {errors.brand && (
                  <ErrorMessage>{errors.brand.message}</ErrorMessage>
                )}
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
                  {errors.images && (
                    <ErrorMessage>{errors.images.message}</ErrorMessage>
                  )}
                </div>

                <div>
                  <Label>Tags (comma separated)</Label>
                  <input {...register('tags')} className={inputClass} />
                </div>
              </div>

              <div className={`${SURFACE_CARD_CLASS} space-y-3 p-5`}>
                <Label>Upload image</Label>
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-[#0f172a]/60 dark:text-zinc-300">
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
                        const token = await user
                          ?.getIdToken()
                          .catch(() => undefined)
                        if (!token)
                          throw new Error('Failed to obtain admin token')
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
                    className={OUTLINE_BUTTON_CLASS}
                  >
                    {uploading ? (
                      <>
                        <Loader2
                          className="size-4 animate-spin"
                          strokeWidth={1.75}
                        />
                        {t('admin.saving')}
                      </>
                    ) : (
                      <>
                        <UploadCloud className="size-4" strokeWidth={1.75} />
                        {t('admin.chooseImage')}
                      </>
                    )}
                  </button>
                </div>
                {watch('thumbnail') ? (
                  <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 dark:border-zinc-700 dark:bg-[#0f172a]/70">
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
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                  {t('admin.saving')}
                </>
              ) : (
                t('admin.saveChanges')
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/product')}
              className={OUTLINE_BUTTON_CLASS}
            >
              {t('admin.cancel')}
            </button>
          </div>
        </form>
      </div>
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
    <section className={`${SURFACE_CARD_CLASS} p-6`}>
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
      {children}
    </label>
  )
}

function ErrorMessage({ children }: { children?: string }) {
  if (!children) return null
  return <p className="mt-1 text-xs font-medium text-rose-600">{children}</p>
}
