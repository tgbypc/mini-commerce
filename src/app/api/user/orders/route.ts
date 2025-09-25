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
    const topOrderIds = new Set(topOrders.map((o) => o.id))
    const subOrders = subOrdersRaw.filter((o) => {
      const source = (o as { source?: string }).source
      if (source === 'ensure' && topOrderIds.has(o.id)) return false
      return true
    })
    const emailOrders = emailSnap
      ? (emailSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown> & { id: string }>)
      : []
    const emailExactOrders = emailExactSnap
      ? (emailExactSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown> & { id: string }>)
      : []

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

    return NextResponse.json(merged)
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    // Fail gracefully with empty list to avoid hard client errors
    return NextResponse.json([])
  }
}
