import { NextResponse } from 'next/server'
import { adminDb, FieldPath } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SortKey = 'createdAt' | 'price' | 'title'
type DynamicTitleField = 'title_en_lc' | 'title_nb_lc'
type SortField = SortKey | DynamicTitleField
type SortDir = 'asc' | 'desc'

function parseIntInRange(v: string | null, d = 20, min = 1, max = 50) {
  const n = v ? Number.parseInt(v, 10) : d
  if (!Number.isFinite(n)) return d
  return Math.max(min, Math.min(max, n))
}

type EncodedCursor = { k: SortField; d: SortDir; v: unknown; id: string }

function decodeCursor(v: string | null): EncodedCursor | null {
  if (!v) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(v, 'base64').toString('utf8'))
    const obj = parsed as Partial<EncodedCursor> | null
    if (
      obj &&
      (obj.k === 'createdAt' || obj.k === 'price' || obj.k === 'title' || obj.k === 'title_en_lc' || obj.k === 'title_nb_lc') &&
      (obj.d === 'asc' || obj.d === 'desc') &&
      typeof obj.id === 'string' &&
      'v' in obj
    ) {
      return { k: obj.k, d: obj.d, v: (obj as EncodedCursor).v, id: obj.id }
    }
  } catch {}
  return null
}

function encodeCursor(cur: EncodedCursor | null): string | null {
  if (!cur) return null
  return Buffer.from(JSON.stringify(cur), 'utf8').toString('base64')
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    const category = (url.searchParams.get('category') || '').trim()
    const categoriesParam = (url.searchParams.get('categories') || '').trim()
    const categories = categoriesParam
      ? categoriesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : (category ? [category] : [])
    const locale = (url.searchParams.get('locale') || 'en').trim().toLowerCase()
    const sortParam = (url.searchParams.get('sort') || 'createdAt-desc').toLowerCase()
    const limit = parseIntInRange(url.searchParams.get('limit'))
    const cursor = decodeCursor(url.searchParams.get('cursor'))

    // Map sort string to field + dir
    let sortField: SortField = 'createdAt'
    let sortDir: SortDir = 'desc'
    if (sortParam === 'price-asc') { sortField = 'price'; sortDir = 'asc' }
    else if (sortParam === 'price-desc') { sortField = 'price'; sortDir = 'desc' }
    else if (sortParam === 'createdat-asc' || sortParam === 'created_at-asc') { sortField = 'createdAt'; sortDir = 'asc' }
    else if (sortParam === 'createdat-desc' || sortParam === 'created_at-desc') { sortField = 'createdAt'; sortDir = 'desc' }
    else if (sortParam === 'title-asc') { sortField = 'title'; sortDir = 'asc' }
    else if (sortParam === 'title-desc') { sortField = 'title'; sortDir = 'desc' }

    // If a search query is present, we constrain by title prefix and force title ordering
    const hasSearch = q.length > 0

    // Build query
    let query: FirebaseFirestore.Query = adminDb.collection('products')

    if (categories.length === 1) {
      query = query.where('category', '==', categories[0])
    } else if (categories.length > 1 && categories.length <= 10) {
      query = query.where('category', 'in', categories)
    }

    if (hasSearch) {
      // Case-insensitive prefix search on localized lowercase field
      const field: DynamicTitleField = locale === 'nb' ? 'title_nb_lc' : 'title_en_lc'
      const ql = q.toLowerCase()
      const upper = ql + '\uf8ff'
      query = query.where(field, '>=', ql).where(field, '<=', upper)
      sortField = field
      sortDir = 'asc'
    }

    // Order by primary sort field only (avoid composite index explosion)
    query = query.orderBy(sortField, sortDir)

    if (cursor) {
      // Only accept cursor that matches the current sort; start after the last sort value
      if (cursor.k === sortField && cursor.d === sortDir) {
        query = query.startAfter(cursor.v)
      }
    }

    query = query.limit(limit)

    let snap: FirebaseFirestore.QuerySnapshot
    let fallbackUsed = false
    try {
      snap = await query.get()
    } catch {
      // Fallback path for index errors: drop filters/ordering gradually
      // 1) Try without category/search but keep sort
      try {
        const q2: FirebaseFirestore.Query = adminDb.collection('products').orderBy(sortField, sortDir).limit(limit)
        snap = await q2.get()
      } catch {
        // 2) Final fallback by document id
        const q3 = adminDb.collection('products').orderBy(FieldPath.documentId(), 'asc').limit(limit)
        snap = await q3.get()
      }
      fallbackUsed = true
    }

    let items = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>
      const title = (() => {
        // localized title: title_{locale} or title.{locale} -> fallback to title
        const flat = data[`title_${locale}`]
        if (typeof flat === 'string' && flat.trim()) return flat as string
        const nested = data['title']
        if (
          nested &&
          typeof nested === 'object' &&
          nested !== null &&
          typeof (nested as Record<string, unknown>)[locale] === 'string'
        ) {
          const v = (nested as Record<string, unknown>)[locale] as string
          if (v.trim()) return v
        }
        return (data.title as string) ?? ''
      })()
      const description = (() => {
        const flat = data[`description_${locale}`]
        if (typeof flat === 'string' && flat.trim()) return flat as string
        const nested = data['description']
        if (
          nested &&
          typeof nested === 'object' &&
          nested !== null &&
          typeof (nested as Record<string, unknown>)[locale] === 'string'
        ) {
          const v = (nested as Record<string, unknown>)[locale] as string
          if (v.trim()) return v
        }
        return (data.description as string) ?? ''
      })()
      return {
        id: d.id,
        title,
        description,
        category: (data.category as string) ?? '',
        brand: (data.brand as string) ?? '',
        price: typeof data.price === 'number' ? (data.price as number) : Number(data.price ?? 0) || 0,
        thumbnail: (data.thumbnail as string) ?? ((Array.isArray(data.images) ? (data.images as string[])[0] : '') || ''),
        stock: typeof data.stock === 'number' ? (data.stock as number) : undefined,
        createdAt: (data.createdAt as FirebaseFirestore.Timestamp | null) ?? null,
      }
    })

    // If fallback used or if we cannot apply Firestore filters, apply lightweight filtering/sorting here
    if (fallbackUsed) {
      const norm = (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : '')
      if (categories.length > 0) {
        const set = new Set(categories.map((c) => c.toLowerCase()))
        items = items.filter((it) => set.has(norm(it.category)))
      }
      if (hasSearch) {
        const ql = q.toLowerCase()
        items = items.filter((it) => norm(it.title).includes(ql))
      }
      // Sort client-side
      const getComparableNumber = (value: unknown) => {
        if (typeof value === 'number') return value
        if (value && typeof value === 'object' && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
          try {
            return (value as { toMillis: () => number }).toMillis()
          } catch {
            return 0
          }
        }
        return Number(value) || 0
      }

      const getComparableString = (value: unknown) => {
        if (typeof value === 'string') return value
        if (value && typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
          const result = (value as { toString: () => string }).toString()
          return result === '[object Object]' ? '' : result
        }
        return String(value ?? '')
      }

      items.sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortField]
        const bv = (b as Record<string, unknown>)[sortField]
        if (sortField === 'price') {
          const an = getComparableNumber(av)
          const bn = getComparableNumber(bv)
          return sortDir === 'asc' ? an - bn : bn - an
        }
        const as = getComparableString(av).toLowerCase()
        const bs = getComparableString(bv).toLowerCase()
        return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
      })
    }

    // Prepare next cursor from the last doc
    const last = snap.docs[snap.docs.length - 1] || null
    let nextCursor = last ? encodeCursor({ k: sortField, d: sortDir, v: (last.get(sortField) as unknown), id: last.id }) : null
    if (fallbackUsed && (category || hasSearch)) {
      // Cursor becomes unreliable with server-side filtering; disable
      nextCursor = null
    }

    return NextResponse.json({
      items,
      nextCursor,
      count: items.length,
      // note: total not returned; computing it is expensive in Firestore
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
