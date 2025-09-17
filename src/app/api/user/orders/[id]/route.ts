import { NextResponse } from 'next/server'
import { adminDb, auth } from '@/lib/firebaseAdmin'

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

export async function GET(req: Request, { params }: { params: Promise<{ id: string | string[] }> }) {
  try {
    const token = extractBearer(req)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const orderId = Array.isArray(id) ? id[0] : id
    if (!orderId) return NextResponse.json({ error: 'Missing order id' }, { status: 400 })

    const decoded = await auth.verifyIdToken(token)
    const uid = decoded.uid

    // First try user subcollection
    const userOrderRef = adminDb.collection('users').doc(uid).collection('orders').doc(orderId)
    const userSnap = await userOrderRef.get()

    let data: any | null = null
    if (userSnap.exists) {
      data = { id: userSnap.id, ...userSnap.data() }
    } else {
      // Fallback to top-level orders
      const topRef = adminDb.collection('orders').doc(orderId)
      const topSnap = await topRef.get()
      if (!topSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const topData = topSnap.data() as any
      if (topData?.userId !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      data = { id: topSnap.id, ...topData }
    }

    // Enrich line items with product thumbnails/titles if available
    const items: Array<any> = Array.isArray(data?.items) ? data.items : []
    const productIds = Array.from(new Set(items.map((it: any) => String(it.productId || '')))).filter(Boolean)
    const productMap = new Map<string, { title?: string; thumbnail?: string; price?: number }>()
    for (const pid of productIds) {
      try {
        const pSnap = await adminDb.collection('products').doc(String(pid)).get()
        if (pSnap.exists) {
          const p = pSnap.data() as any
          productMap.set(String(pid), { title: p?.title, thumbnail: p?.thumbnail, price: p?.price })
        }
      } catch {}
    }

    const enrichedItems = items.map((it: any) => {
      const pid = String(it.productId || '')
      const meta = productMap.get(pid)
      const unitAmountMajor = typeof it.unitAmount === 'number' ? it.unitAmount / 100 : undefined
      return {
        productId: pid || null,
        description: it.title || it.description || meta?.title || 'Item',
        quantity: it.quantity ?? 0,
        unitAmount: unitAmountMajor ?? meta?.price ?? null,
        currency: (it.currency || data?.currency || 'usd').toUpperCase(),
        thumbnail: meta?.thumbnail || null,
      }
    })

    const result = {
      id: data.id,
      sessionId: data.sessionId,
      amountTotal: data.amountTotal ?? null,
      currency: (data.currency || 'usd').toUpperCase(),
      paymentStatus: data.paymentStatus ?? null,
      createdAt: data.createdAt ?? null,
      items: enrichedItems,
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[orders:id] error', e)
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
  }
}

