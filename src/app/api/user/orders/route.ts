// Route Handler (Node runtime). Do not use 'use server' here.

import { NextResponse } from 'next/server'
import { auth, adminDb } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function extractBearer(req: Request): string | null {
  try {
    const h = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    if (!h) return null
    if (h.startsWith('Bearer ')) return h.slice(7).trim()
    return h.trim() || null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  try {
    const token = extractBearer(req)
    if (!token) {
      // No token: return empty list to keep UX smooth on client fallbacks
      return NextResponse.json([])
    }

    const decodedToken = await auth.verifyIdToken(token)
    const uid = decodedToken.uid
    const emailLc = typeof decodedToken.email === 'string'
      ? decodedToken.email.toLowerCase()
      : null

    // Prefer user subcollection
    const subSnap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .get()

    const subOrdersRaw = subSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown> & { id: string }>

    // Also attempt top-level orders filtered by userId (webhook also writes here)
    const topOrdersQuery = adminDb
      .collection('orders')
      .where('userId', '==', uid)

    const emailQuery = emailLc
      ? adminDb.collection('orders').where('emailLc', '==', emailLc)
      : null
    const emailExactQuery = decodedToken.email
      ? adminDb.collection('orders').where('email', '==', decodedToken.email)
      : null

    const [topSnap, emailSnap, emailExactSnap] = await Promise.all([
      topOrdersQuery.get(),
      emailQuery ? emailQuery.get() : Promise.resolve(null),
      emailExactQuery ? emailExactQuery.get() : Promise.resolve(null),
    ])

    const topOrders = topSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown> & { id: string }>
    const emailOrders = emailSnap
      ? (emailSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown> & { id: string }>)
      : []
    const emailExactOrders = emailExactSnap
      ? (emailExactSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown> & { id: string }>)
      : []

    const canonicalOrderIds = new Set<string>([
      ...topOrders.map((o) => o.id),
      ...emailOrders.map((o) => o.id),
      ...emailExactOrders.map((o) => o.id),
    ])

    const staleUserOrderIds: string[] = []
    const subOrders = subOrdersRaw.filter((o) => {
      if (!canonicalOrderIds.has(o.id)) {
        staleUserOrderIds.push(o.id)
        return false
      }
      return true
    })

    if (staleUserOrderIds.length) {
      try {
        const batch = adminDb.batch()
        const userOrdersRef = adminDb.collection('users').doc(uid).collection('orders')
        for (const id of staleUserOrderIds) {
          batch.delete(userOrdersRef.doc(id))
        }
        await batch.commit()
      } catch (cleanupError) {
        console.warn('[user-orders] cleanup stale ensure docs failed', cleanupError)
      }
    }

    // Merge by id and sort desc by createdAt
    type OrderDoc = Record<string, unknown> & { id: string }

    function keyFor(order: OrderDoc): string {
      const raw = (order as { sessionId?: unknown }).sessionId
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if (trimmed) return trimmed
      }
      return order.id
    }

    function getSource(order: OrderDoc): string {
      const source = (order as { source?: unknown }).source
      return typeof source === 'string' ? source : ''
    }

    function pickPreferred(current: OrderDoc, candidate: OrderDoc, key: string): OrderDoc {
      const currentSource = getSource(current)
      const candidateSource = getSource(candidate)

      if (currentSource === 'ensure' && candidateSource && candidateSource !== 'ensure') {
        return candidate
      }
      if (candidateSource === 'ensure' && currentSource && currentSource !== 'ensure') {
        return current
      }
      if (candidate.id === key && current.id !== key && candidateSource !== 'ensure') {
        return candidate
      }
      if (current.id === key && candidate.id !== key && currentSource !== 'ensure') {
        return current
      }

      const currentUpdated = toMillis((current as { updatedAt?: unknown }).updatedAt)
      const candidateUpdated = toMillis((candidate as { updatedAt?: unknown }).updatedAt)
      return candidateUpdated > currentUpdated ? candidate : current
    }

    const map = new Map<string, OrderDoc>()
    for (const o of [...subOrders, ...topOrders, ...emailOrders, ...emailExactOrders]) {
      const key = keyFor(o)
      const existing = map.get(key)
      if (!existing) {
        map.set(key, o)
        continue
      }
      map.set(key, pickPreferred(existing, o, key))
    }
    function toMillis(v: unknown): number {
      const withToMillis = v as { toMillis?: () => number } | null
      if (withToMillis && typeof withToMillis.toMillis === 'function') {
        try { return withToMillis.toMillis!() } catch { /* no-op */ }
      }
      const withSeconds = v as { seconds?: number } | null
      if (withSeconds && typeof withSeconds.seconds === 'number') {
        return withSeconds.seconds! * 1000
      }
      return 0
    }

    const merged = Array.from(map.values()).sort((a, b) => {
      const aCreated = (a as { createdAt?: unknown }).createdAt
      const bCreated = (b as { createdAt?: unknown }).createdAt
      return toMillis(aCreated) < toMillis(bCreated) ? 1 : -1
    })

    // Collect product ids for enrichment
    const productIds = new Set<string>()
    type OrderItem = { productId?: unknown; title?: unknown; description?: unknown; quantity?: unknown; unitAmount?: unknown; currency?: unknown }
    const normalized = merged.map((order) => {
      const items = Array.isArray((order as { items?: unknown }).items)
        ? ((order as { items?: unknown }).items as OrderItem[])
        : []
      for (const it of items) {
        const pid = String(it?.productId ?? '')
        if (pid) productIds.add(pid)
      }
      return { ...order, items }
    })

    const productMeta = new Map<string, { title?: string; thumbnail?: string }>()
    for (const pid of productIds) {
      try {
        const snap = await adminDb.collection('products').doc(pid).get()
        if (snap.exists) {
          const data = snap.data() as { title?: string; thumbnail?: string }
          productMeta.set(pid, {
            title: typeof data?.title === 'string' ? data.title : undefined,
            thumbnail: typeof data?.thumbnail === 'string' ? data.thumbnail : undefined,
          })
        }
      } catch {
        // ignore individual failures
      }
    }

    const enriched = normalized.map((order) => {
      const items = (order.items as OrderItem[]).map((item) => {
        const pid = String(item?.productId ?? '')
        const meta = productMeta.get(pid)
        return {
          ...item,
          productId: pid || undefined,
          title:
            typeof item?.title === 'string' && item.title.trim()
              ? item.title
              : typeof item?.description === 'string' && item.description.trim()
                ? item.description
                : meta?.title,
          thumbnail: meta?.thumbnail ?? undefined,
        }
      })
      return { ...order, items }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    // Fail gracefully with empty list to avoid hard client errors
    return NextResponse.json([])
  }
}
