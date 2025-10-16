'use client'

import { useState, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-hot-toast'
import { ArrowLeftCircle, Loader2, Sparkles, UploadCloud } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { PRIMARY_CATEGORY_SLUGS } from '@/lib/constants/categories'

const CATEGORY_OPTIONS = PRIMARY_CATEGORY_SLUGS

const HERO_SURFACE_CLASS =
  'rounded-4xl border border-zinc-200 bg-white/95 shadow-[0_32px_56px_-30px_rgba(15,23,42,0.28)] dark:border-zinc-700 dark:bg-[#111827]'
const SURFACE_CARD_CLASS =
  'w-full rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_26px_52px_-32px_rgba(15,23,42,0.22)] transition-transform duration-200 backdrop-blur dark:border-zinc-700 dark:bg-[#0f172a]/80'
const PRIMARY_BUTTON_CLASS =
  'btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60'
const OUTLINE_BUTTON_CLASS =
  'btn-outline gap-2 disabled:cursor-not-allowed disabled:opacity-60'

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

const FIELD_BASE_CLASS =
  'w-full rounded-2xl border border-zinc-200 bg-white/90 px-4 py-2 text-sm text-[#0d141c] shadow-sm transition focus:border-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20 dark:border-zinc-700 dark:bg-[#0f172a]/80 dark:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60'
const inputClass = FIELD_BASE_CLASS
const textareaClass = `${FIELD_BASE_CLASS} min-h-[140px]`
const selectClass = FIELD_BASE_CLASS

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
  const formRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeLocale, setActiveLocale] = useState<'en' | 'nb'>('en')

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
                Catalog launchpad
              </span>
              <h1 className="text-3xl font-semibold md:text-4xl">
                Launch a product listing
              </h1>
              <p className="max-w-2xl text-sm text-zinc-600 md:text-base dark:text-zinc-300">
                Capture localized copy, imagery, and inventory details in a
                workspace styled after the admin messages experience.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  formRef.current?.scrollIntoView({ behavior: 'smooth' })
                }
                className={PRIMARY_BUTTON_CLASS}
              >
                <Sparkles className="size-4" strokeWidth={1.75} />
                Start drafting
              </button>
              <Link href="/admin/product" className={OUTLINE_BUTTON_CLASS}>
                <ArrowLeftCircle className="size-4" strokeWidth={1.75} />
                Back to catalog
              </Link>
            </div>
          </div>
        </section>

        <form
          ref={formRef}
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-6"
        >
          <FormSection
            title="Localized content"
            description="Keep English and Norwegian content aligned before launch."
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
            </div>

            <div className="mt-4 space-y-6">
              <div>
                <Label>Title ({activeLocale.toUpperCase()})</Label>
                <input
                  {...register('title_en')}
                  className={clsx(inputClass, activeLocale !== 'en' && 'hidden')}
                  placeholder="English title"
                />
                <input
                  {...register('title_nb')}
                  className={clsx(inputClass, activeLocale !== 'nb' && 'hidden')}
                  placeholder="Norsk tittel"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {t('admin.localeDescription').replace(
                    '{loc}',
                    activeLocale.toUpperCase()
                  )}
                </Label>
                <textarea
                  {...register('description_en')}
                  className={clsx(
                    textareaClass,
                    activeLocale !== 'en' && 'hidden'
                  )}
                  placeholder="English description"
                />
                <textarea
                  {...register('description_nb')}
                  className={clsx(
                    textareaClass,
                    activeLocale !== 'nb' && 'hidden'
                  )}
                  placeholder="Beskrivelse (norsk)"
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Pricing & inventory"
            description="Set storefront-ready numbers for demos and QA flows."
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
            description="Upload through Vercel Blob or paste deterministic asset URLs."
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

              <div className={`${SURFACE_CARD_CLASS} space-y-3 p-5`}>
                <Label>{t('admin.uploadImage')}</Label>
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-[#0f172a]/60 dark:text-zinc-300">
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {selectedFileName || t('admin.noFile')}
                    </div>
                  </div>
                </div>

                {watch('thumbnail') ? (
                  <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 dark:border-zinc-700 dark:bg-[#0f172a]/70">
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
              className={PRIMARY_BUTTON_CLASS}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                  {t('admin.saving')}
                </>
              ) : (
                <>
                  <Sparkles className="size-4" strokeWidth={1.75} />
                  Save product
                </>
              )}
            </button>
            <Link href="/admin/product" className={OUTLINE_BUTTON_CLASS}>
              <ArrowLeftCircle className="size-4" strokeWidth={1.75} />
              Cancel
            </Link>
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
  return (
    <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
      {children}
    </p>
  )
}
