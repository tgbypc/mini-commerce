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

    // Prefer user subcollection
    const subSnap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .get()

    const subOrders = subSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown> & { id: string }>

    // Also attempt top-level orders filtered by userId (webhook also writes here)
    const topSnap = await adminDb
      .collection('orders')
      .where('userId', '==', uid)
      .get()

    const topOrders = topSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown> & { id: string }>

    // Merge by id and sort desc by createdAt
    const map = new Map<string, Record<string, unknown>>()
    for (const o of [...subOrders, ...topOrders]) map.set(o.id, o)
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
