import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SortKey = 'createdAt' | 'price' | 'title'
type SortDir = 'asc' | 'desc'

function parseIntInRange(v: string | null, d = 20, min = 1, max = 50) {
  const n = v ? Number.parseInt(v, 10) : d
  if (!Number.isFinite(n)) return d
  return Math.max(min, Math.min(max, n))
}

function decodeCursor(v: string | null): { k: SortKey; d: SortDir; v: unknown; id: string } | null {
  if (!v) return null
  try {
    const json = JSON.parse(Buffer.from(v, 'base64').toString('utf8')) as any
    if (json && json.k && json.d && 'v' in json && typeof json.id === 'string') {
      return { k: json.k, d: json.d, v: json.v, id: json.id }
    }
  } catch {}
  return null
}

function encodeCursor(cur: { k: SortKey; d: SortDir; v: unknown; id: string } | null): string | null {
  if (!cur) return null
  return Buffer.from(JSON.stringify(cur), 'utf8').toString('base64')
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    const category = (url.searchParams.get('category') || '').trim()
    const sortParam = (url.searchParams.get('sort') || 'createdAt-desc').toLowerCase()
    const limit = parseIntInRange(url.searchParams.get('limit'))
    const cursor = decodeCursor(url.searchParams.get('cursor'))

    // Map sort string to field + dir
    let sortField: SortKey = 'createdAt'
    let sortDir: SortDir = 'desc'
    if (sortParam === 'price-asc') { sortField = 'price'; sortDir = 'asc' }
    else if (sortParam === 'price-desc') { sortField = 'price'; sortDir = 'desc' }
    else if (sortParam === 'createdat-asc' || sortParam === 'created_at-asc') { sortField = 'createdAt'; sortDir = 'asc' }
    else if (sortParam === 'createdat-desc' || sortParam === 'created_at-desc') { sortField = 'createdAt'; sortDir = 'desc' }
    else if (sortParam === 'title-asc') { sortField = 'title'; sortDir = 'asc' }
    else if (sortParam === 'title-desc') { sortField = 'title'; sortDir = 'desc' }

    // If a search query is present, we constrain by title prefix and force title ordering
    const hasSearch = q.length > 0
    if (hasSearch) {
      sortField = 'title'
      // Keep client-chosen dir if it is for title; otherwise default asc for deterministic paging
      if (sortParam !== 'title-asc' && sortParam !== 'title-desc') sortDir = 'asc'
    }

    // Build query
    let query: FirebaseFirestore.Query = adminDb.collection('products')

    if (category) {
      query = query.where('category', '==', category)
    }

    if (hasSearch) {
      // Prefix search on title (case-sensitive). For case-insensitive, store and query a lowercase field.
      const upper = q + '\uf8ff'
      query = query.where('title', '>=', q).where('title', '<=', upper)
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
    try {
      snap = await query.get()
    } catch (e) {
      // Fallback path for index errors: drop filters/ordering gradually
      // 1) Try without category/search but keep sort
      try {
        let q2: FirebaseFirestore.Query = adminDb.collection('products').orderBy(sortField, sortDir).limit(limit)
        snap = await q2.get()
      } catch {
        // 2) Final fallback by document id
        const q3 = adminDb.collection('products').orderBy(adminDb.firestore.FieldPath.documentId(), 'asc').limit(limit)
        snap = await q3.get()
      }
    }

    const items = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>
      return {
        id: d.id,
        title: (data.title as string) ?? '',
        description: (data.description as string) ?? '',
        category: (data.category as string) ?? '',
        brand: (data.brand as string) ?? '',
        price: typeof data.price === 'number' ? (data.price as number) : Number(data.price ?? 0) || 0,
        thumbnail: (data.thumbnail as string) ?? ((Array.isArray(data.images) ? (data.images as string[])[0] : '') || ''),
        stock: typeof data.stock === 'number' ? (data.stock as number) : undefined,
        createdAt: (data.createdAt as any) ?? null,
      }
    })

    // Prepare next cursor from the last doc
    const last = snap.docs[snap.docs.length - 1] || null
    const nextCursor = last ? encodeCursor({ k: sortField, d: sortDir, v: (last.get(sortField) as unknown), id: last.id }) : null

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
