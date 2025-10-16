import { describe, expect, it, vi } from 'vitest'
import {
  CATEGORY_GROUPS,
  collectGroupMatches,
  getGroupSlugForCategory,
  resolveCategoryGroups,
} from '@/lib/constants/categories'
import { fetchDistinctProductCategories } from '@/lib/server/categories'
import { adminDb } from '@/lib/firebaseAdmin'

function makeDoc(value: unknown) {
  return {
    get: vi.fn(() => value),
  }
}

describe('fetchDistinctProductCategories', () => {
  it('returns unique trimmed categories from Firestore', async () => {
    const getMock = vi.fn(async () => ({
      docs: [
        makeDoc(' Beauty '),
        makeDoc('Beauty'),
        makeDoc('Home'),
        makeDoc(''), // ignored
        makeDoc(null), // ignored
      ],
    }))
    const selectMock = vi.fn().mockReturnValue({
      get: getMock,
    })

    vi.mocked(adminDb.collection).mockImplementationOnce(() =>
      ({
        select: selectMock,
      }) as unknown as ReturnType<typeof adminDb.collection>
    )

    const categories = await fetchDistinctProductCategories()
    expect(selectMock).toHaveBeenCalledWith('category')
    expect(categories.sort()).toEqual(['Beauty', 'Home'])
  })

  it('falls back to static groups when Firestore call fails', async () => {
    const selectMock = vi.fn().mockReturnValue({
      get: vi.fn(async () => {
        throw new Error('firestore down')
      }),
    })

    vi.mocked(adminDb.collection).mockImplementationOnce(() =>
      ({
        select: selectMock,
      }) as unknown as ReturnType<typeof adminDb.collection>
    )

    const categories = await fetchDistinctProductCategories()
    expect(categories).toEqual(CATEGORY_GROUPS.map((group) => group.slug))
  })
})

describe('category helpers', () => {
  it('resolves category groups and preserves leftover categories', () => {
    const resolved = resolveCategoryGroups([
      ' Beauty ',
      'beauty',
      'ELECTRONICS',
      'home-kitchen',
      'unknown category',
    ])

    const beauty = resolved.find((group) => group.slug === 'beauty')
    expect(beauty?.isKnown).toBe(true)
    expect(beauty?.categories).toEqual(['Beauty'])

    const electronics = resolved.find((group) => group.slug === 'electronics')
    expect(electronics?.categories).toContain('ELECTRONICS')

    const leftovers = resolved.filter((group) => !group.isKnown)
    expect(leftovers).toHaveLength(1)
    expect(leftovers[0]?.slug).toBe('unknown-category')
    expect(leftovers[0]?.categories).toEqual(['unknown category'])
  })

  it('collects categories for selected groups without duplicates', () => {
    const groups = resolveCategoryGroups(['Beauty', 'beauty', 'Home'])
    const collected = collectGroupMatches(['beauty', 'home'], groups)
    expect(collected).toEqual(['Beauty', 'Home'])
  })

  it('maps arbitrary category names back to a known slug', () => {
    expect(getGroupSlugForCategory('Mens-Watches')).toBe('fashion')
    expect(getGroupSlugForCategory('unknown-item')).toBeNull()
  })
})
