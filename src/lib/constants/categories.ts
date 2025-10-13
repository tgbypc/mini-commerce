// src/lib/constants/categories.ts

const DEFAULT_ACCENT = 'from-[#f6f7fb] to-white'

export type CategoryGroupConfig = {
  slug: string
  labelKey: string
  descriptionKey: string
  accent: string
  matches: readonly string[]
}

export type ResolvedCategoryGroup = {
  slug: string
  categories: string[]
  labelKey: string | null
  descriptionKey: string | null
  accent: string
  isKnown: boolean
}

export const CATEGORY_GROUPS: CategoryGroupConfig[] = [
  {
    slug: 'beauty',
    labelKey: 'store.categories.list.beauty.label',
    descriptionKey: 'store.categories.list.beauty.description',
    accent: 'from-[#fbe8ff] to-[#f2f8ff]',
    matches: [
      'beauty',
      'cosmetic',
      'cosmetics',
      'fragrance',
      'fragrances',
      'makeup',
      'skincare',
      'skin-care',
      'hair',
      'hair-care',
      'body',
      'body-care',
      'personal-care',
    ],
  },
  {
    slug: 'electronics',
    labelKey: 'store.categories.list.electronics.label',
    descriptionKey: 'store.categories.list.electronics.description',
    accent: 'from-[#e4f6ff] to-[#eef2ff]',
    matches: [
      'electronics',
      'smartphones',
      'laptops',
      'mobile-accessories',
      'tablets',
      'audio',
      'sound-system',
      'sound-systems',
      'cameras',
      'camera',
      'smart-home',
      'computers',
      'pc',
    ],
  },
  {
    slug: 'home',
    labelKey: 'store.categories.list.home.label',
    descriptionKey: 'store.categories.list.home.description',
    accent: 'from-[#fff4e5] to-[#f2fbf2]',
    matches: [
      'home',
      'home-decor',
      'home-decoration',
      'home-decoration',
      'home-kitchen',
      'kitchen',
      'kitchen-accessories',
      'kitchen-appliances',
      'furniture',
      'decor',
      'lighting',
      'appliances',
      'household',
    ],
  },
  {
    slug: 'fashion',
    labelKey: 'store.categories.list.fashion.label',
    descriptionKey: 'store.categories.list.fashion.description',
    accent: 'from-[#fff0f3] to-[#f0f7ff]',
    matches: [
      'fashion',
      'clothing',
      'apparel',
      'mens-clothing',
      'mens-shirts',
      'mens-shoes',
      'mens-watches',
      'womens-clothing',
      'womens-dresses',
      'womens-shoes',
      'womens-watches',
      'womens-jewellery',
      'jewellery',
      'jewelry',
      'bags',
      'handbags',
      'sunglasses',
      'tops',
      'footwear',
      'accessories',
    ],
  },
  {
    slug: 'wellness',
    labelKey: 'store.categories.list.wellness.label',
    descriptionKey: 'store.categories.list.wellness.description',
    accent: 'from-[#e6fdf5] to-[#edf3ff]',
    matches: [
      'wellness',
      'fitness',
      'health',
      'groceries',
      'grocery',
      'food',
      'beverages',
      'supplements',
      'nutrition',
    ],
  },
  {
    slug: 'outdoor',
    labelKey: 'store.categories.list.outdoor.label',
    descriptionKey: 'store.categories.list.outdoor.description',
    accent: 'from-[#f1f8ff] to-[#f7fff1]',
    matches: [
      'outdoor',
      'outdoors',
      'sports',
      'sports-accessories',
      'automotive',
      'motorcycle',
      'travel',
      'luggage',
      'camping',
      'hiking',
      'garden',
      'tools',
      'diy',
    ],
  },
] as const

const PRIMARY_CATEGORY_SET = new Set<string>()
const MATCH_TO_GROUP = new Map<string, string>()

for (const group of CATEGORY_GROUPS) {
  PRIMARY_CATEGORY_SET.add(group.slug)
  const keys = new Set<string>([group.slug, ...group.matches])
  for (const key of keys) {
    MATCH_TO_GROUP.set(key, group.slug)
  }
}

export const PRIMARY_CATEGORY_SLUGS = CATEGORY_GROUPS.map((group) => group.slug)

export function getGroupBySlug(slug: string): CategoryGroupConfig | undefined {
  const key = slug.trim().toLowerCase()
  return CATEGORY_GROUPS.find((group) => group.slug === key)
}

export function getGroupAccent(slug: string): string {
  return getGroupBySlug(slug)?.accent ?? DEFAULT_ACCENT
}

export function fallbackLabelFromSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function resolveCategoryGroups(
  rawCategories: readonly string[]
): ResolvedCategoryGroup[] {
  const normalized = new Map<string, Set<string>>()
  for (const raw of rawCategories) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    const lower = trimmed.toLowerCase()
    if (!normalized.has(lower)) normalized.set(lower, new Set())
    normalized.get(lower)!.add(trimmed)
  }

  const consumed = new Set<string>()
  const resolved: ResolvedCategoryGroup[] = []

  for (const group of CATEGORY_GROUPS) {
    const matches = new Set<string>([group.slug, ...group.matches])
    const actualValues: string[] = []

    for (const key of matches) {
      const set = normalized.get(key)
      if (!set) continue
      for (const value of set) {
        const lower = value.toLowerCase()
        if (actualValues.some((item) => item.toLowerCase() === lower)) continue
        actualValues.push(value)
        consumed.add(lower)
      }
    }

    if (actualValues.length === 0) continue
    resolved.push({
      slug: group.slug,
      categories: actualValues,
      labelKey: group.labelKey,
      descriptionKey: group.descriptionKey,
      accent: group.accent,
      isKnown: true,
    })
  }

  const leftovers: ResolvedCategoryGroup[] = []
  for (const [key, set] of normalized.entries()) {
    if (consumed.has(key)) continue
    const values = Array.from(set)
    if (values.length === 0) continue
    const fallbackSlug =
      values[0]
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'other'
    const slug =
      key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallbackSlug
    leftovers.push({
      slug,
      categories: values,
      labelKey: null,
      descriptionKey: null,
      accent: DEFAULT_ACCENT,
      isKnown: false,
    })
  }

  leftovers.sort((a, b) => a.slug.localeCompare(b.slug))

  return [...resolved, ...leftovers]
}

export function collectGroupMatches(
  slugs: readonly string[],
  groups: readonly ResolvedCategoryGroup[],
  limit = 10
): string[] {
  if (!Array.isArray(slugs) || slugs.length === 0) return []
  const lookup = new Map(groups.map((group) => [group.slug, group]))
  const seen = new Set<string>()
  const collected: string[] = []

  for (const slug of slugs) {
    const group = lookup.get(slug)
    if (!group) continue
    for (const category of group.categories) {
      const key = category.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      collected.push(category)
      if (collected.length >= limit) return collected
    }
  }

  return collected
}

export function getGroupSlugForCategory(category: string): string | null {
  const key = category.trim().toLowerCase()
  return MATCH_TO_GROUP.get(key) ?? null
}

export function categoryLabelKey(slug: string): string | null {
  return getGroupBySlug(slug)?.labelKey ?? null
}

export function categoryDescriptionKey(slug: string): string | null {
  return getGroupBySlug(slug)?.descriptionKey ?? null
}

export function isPrimaryCategory(slug: string): boolean {
  return PRIMARY_CATEGORY_SET.has(slug.trim().toLowerCase())
}
