import { adminDb } from '@/lib/firebaseAdmin'
import { CATEGORY_GROUPS } from '@/lib/constants/categories'

export async function fetchDistinctProductCategories(): Promise<string[]> {
  try {
    const snap = await adminDb.collection('products').select('category').get()
    const categories = new Set<string>()
    for (const doc of snap.docs) {
      const value = doc.get('category')
      if (typeof value !== 'string') continue
      const trimmed = value.trim()
      if (!trimmed) continue
      categories.add(trimmed)
    }
    if (categories.size > 0) {
      return Array.from(categories)
    }
  } catch (error) {
    console.error('[categories] failed to fetch distinct categories', error)
  }
  return CATEGORY_GROUPS.map((group) => group.slug)
}
