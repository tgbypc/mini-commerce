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

    const subOrders = subSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    // Also attempt top-level orders filtered by userId (webhook also writes here)
    const topSnap = await adminDb
      .collection('orders')
      .where('userId', '==', uid)
      .get()

    const topOrders = topSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    // Merge by id and sort desc by createdAt
    const map = new Map<string, Record<string, any>>()
    for (const o of [...subOrders, ...topOrders]) map.set(o.id, o)
    const merged = Array.from(map.values()).sort((a, b) => {
      const aTs = (a.createdAt as any)?.toMillis?.() ?? (a.createdAt as any)?.seconds ?? 0
      const bTs = (b.createdAt as any)?.toMillis?.() ?? (b.createdAt as any)?.seconds ?? 0
      return bTs - aTs
    })

    return NextResponse.json(merged)
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    // Fail gracefully with empty list to avoid hard client errors
    return NextResponse.json([])
  }
}
