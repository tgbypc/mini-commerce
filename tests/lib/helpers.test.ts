import { describe, expect, it } from 'vitest'
import { pickI18nString } from '@/lib/i18nContent'
import {
  formatOrderReference,
  getOrderReferenceSegment,
} from '@/lib/orderReference'
import { productSchema } from '@/lib/validation/products'
import { AvailabilityStatus } from '@/types/product'

describe('pickI18nString', () => {
  it('returns locale-specific flat key', () => {
    const data = {
      title_en: 'English title',
      title_nb: 'Norwegian title',
    }
    expect(pickI18nString(data, 'title', 'nb')).toBe('Norwegian title')
  })

  it('falls back to nested object value or base string', () => {
    const data = {
      title: {
        en: 'Nested English',
      },
      description: 'Plain description',
    }
    expect(pickI18nString(data, 'title', 'en')).toBe('Nested English')
    expect(pickI18nString(data, 'description', 'nb')).toBe('Plain description')
    expect(pickI18nString({}, 'missing', 'en')).toBe('')
  })
})

describe('orderReference utilities', () => {
  it('generates segment and formatted reference from raw id', () => {
    expect(getOrderReferenceSegment(' order-123abc ')).toBe('123ABC')
    expect(formatOrderReference(' order-123abc ')).toBe('#123ABC')
  })

  it('returns null for invalid identifiers', () => {
    expect(getOrderReferenceSegment('   ')).toBeNull()
    expect(formatOrderReference(null)).toBeNull()
  })
})

describe('productSchema', () => {
  it('normalizes category, price, media fields and tags', () => {
    const parsed = productSchema.parse({
      title: 'Scandinavian Desk',
      description:
        'A beautifully crafted wooden desk with plenty of storage and cable management.',
      category: 'Kitchen ',
      brand: '  Nordic Furnishings ',
      price: '199,90',
      stock: '5',
      availabilityStatus: AvailabilityStatus.IN_STOCK,
      thumbnail: [' https://example.com/thumb.jpg ', 'https://example.com/alt.jpg'],
      images:
        ' https://example.com/img1.jpg \nhttps://example.com/img2.jpg\n \n',
      tags: '  home , office  , productivity ',
    })

    expect(parsed.category).toBe('home')
    expect(parsed.brand).toBe('Nordic Furnishings')
    expect(parsed.price).toBeCloseTo(199.9)
    expect(parsed.stock).toBe(5)
    expect(parsed.thumbnail).toBe('https://example.com/thumb.jpg')
    expect(parsed.images).toEqual([
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg',
    ])
    expect(parsed.tags).toEqual(['home', 'office', 'productivity'])
  })

  it('throws validation error for unsupported category', () => {
    expect(() =>
      productSchema.parse({
        title: 'Product',
        description:
          'This description is intentionally long enough to pass validation requirements of the schema.',
        category: 'unknown',
        brand: '',
        price: 10,
        stock: 1,
        availabilityStatus: AvailabilityStatus.IN_STOCK,
        thumbnail: 'https://example.com/image.jpg',
        images: [],
        tags: [],
      })
    ).toThrowError()
  })
})
