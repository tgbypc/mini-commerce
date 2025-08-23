// src/lib/validation/products.ts
import { z } from 'zod'
import { AvailabilityStatus } from '@/types/product'
import { CATEGORIES } from '@/lib/constants/categories'

// ✅ Tek kaynaklı kategori listesi (Zod enum olarak tanımla)
export const CategorySchema = z.enum(CATEGORIES)
export type Category = (typeof CATEGORIES)[number]

// küçük yardımcı
const normalizeString = (v: unknown) =>
  typeof v === 'string' ? v.trim() : v

const normalizeCategory = (v: unknown) =>
  typeof v === 'string' ? v.trim().toLowerCase() : v

export const productSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 chars').max(80),
  description: z.string().min(50, 'Description must be at least 50 chars').max(1000),

  // 🔧 Kategori: trim + lowercase sonra enum
  category: z.preprocess(
    normalizeCategory,
    CategorySchema
  ),

  brand: z.preprocess(
    normalizeString,
    z.string().max(40).optional().or(z.literal(''))
  ),

  price: z.preprocess(
    (v) => (typeof v === 'string' ? v.replace(',', '.') : v),
    z.coerce.number().positive('Price must be > 0').max(100000)
  ),
  stock: z.coerce.number().int('Stock must be integer').nonnegative('Stock can’t be negative').max(100000),

  availabilityStatus: z.nativeEnum(AvailabilityStatus).default(AvailabilityStatus.IN_STOCK),

  thumbnail: z.preprocess(
    (v) => {
      if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0].trim() : v[0]
      return normalizeString(v)
    },
    z.string().url('Thumbnail must be a valid URL')
  ),

  // Textarea’dan çoklu URL girildiğinde satır satır alacaksan formda setValueAs ile diziye çevir.
  images: z.preprocess(
    (v) => {
      if (Array.isArray(v)) {
        return v
          .map((s) => (typeof s === 'string' ? s.trim() : s))
          .filter(Boolean)
      }
      if (typeof v === 'string') {
        return v
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      }
      return []
    },
    z.array(z.string().url('Each image must be a valid URL')).max(8)
  ).optional().default([]),

  // "tag1, tag2" gibi girilen değeri diziye çevir
  tags: z.preprocess(
    (v) => {
      if (Array.isArray(v)) {
        return v
          .map((s) => (typeof s === 'string' ? s.trim() : s))
          .filter(Boolean)
      }
      if (typeof v === 'string') {
        return v
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      }
      return []
    },
    z.array(z.string()).max(10)
  ).optional().default([]),
})

export type ProductFormValues = z.infer<typeof productSchema>