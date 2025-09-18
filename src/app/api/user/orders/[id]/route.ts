import { NextResponse } from 'next/server'
import { adminDb, auth } from '@/lib/firebaseAdmin'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'
import {
  extractShippingDetails,
  toShippingInfo,
  type ShippingInfo,
} from '@/app/api/user/orders/shipping'

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

type RawOrderItem = {
  productId?: string | null
  title?: string | null
  description?: string | null
  quantity?: number | null
  unitAmount?: number | null
  currency?: string | null
}

type StripeSession = Stripe.Checkout.Session

type RawOrder = {
  id: string
  sessionId?: string
  amountTotal?: number | null
  currency?: string | null
  paymentStatus?: string | null
  status?: 'paid' | 'fulfilled' | 'shipped' | 'delivered' | 'canceled'
  shipping?: ShippingInfo | null
  createdAt?: FirebaseFirestore.Timestamp | Date | null
  userId?: string | null
  items?: RawOrderItem[]
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

    let data: RawOrder | null = null
    if (userSnap.exists) {
      data = { id: userSnap.id, ...(userSnap.data() as Omit<RawOrder, 'id'>) }
    } else {
      // Fallback to top-level orders
      const topRef = adminDb.collection('orders').doc(orderId)
      const topSnap = await topRef.get()
      if (!topSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const topData = topSnap.data() as Omit<RawOrder, 'id'>
      if (topData?.userId !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      data = { id: topSnap.id, ...topData }
    }

    // Enrich line items with product thumbnails/titles if available
    const items: RawOrderItem[] = Array.isArray(data?.items) ? (data!.items as RawOrderItem[]) : []
    const productIds = Array.from(new Set(items.map((it) => String(it?.productId || '')))).filter(Boolean)
    const productMap = new Map<string, { title?: string; thumbnail?: string; price?: number | null }>()
    for (const pid of productIds) {
      try {
        const pSnap = await adminDb.collection('products').doc(String(pid)).get()
        if (pSnap.exists) {
          const p = pSnap.data() as { title?: string; thumbnail?: string; price?: number | null }
          productMap.set(String(pid), { title: p?.title, thumbnail: p?.thumbnail, price: p?.price ?? null })
        }
      } catch {}
    }

    const enrichedItems = items.map((it) => {
      const pid = String(it?.productId || '')
      const meta = productMap.get(pid)
      const unitAmountMajor = typeof it?.unitAmount === 'number' ? it.unitAmount! / 100 : undefined
      return {
        productId: pid || null,
        description: it?.title || it?.description || meta?.title || 'Item',
        quantity: it?.quantity ?? 0,
        unitAmount: unitAmountMajor ?? meta?.price ?? null,
        currency: ((it?.currency || data?.currency || 'usd') as string).toUpperCase(),
        thumbnail: meta?.thumbnail || null,
      }
    })

    // Optional: enrich shipping from Stripe if missing
    let shipping: ShippingInfo | null = data.shipping ?? null
    if (!shipping && data.sessionId) {
      try {
        const rawSession = await stripe.checkout.sessions.retrieve(String(data.sessionId), {
          expand: ['shipping_cost.shipping_rate'],
        })
        const full = rawSession as StripeSession
        shipping = toShippingInfo({
          cost: full.shipping_cost ?? null,
          details: extractShippingDetails(full),
          customer: full.customer_details ?? null,
        })
      } catch {}
    }

    const result = {
      id: data.id,
      sessionId: data.sessionId,
      amountTotal: data.amountTotal ?? null,
      currency: (data.currency || 'usd').toUpperCase(),
      paymentStatus: data.paymentStatus ?? null,
      status: data.status ?? 'paid',
      shipping,
      createdAt: data.createdAt ?? null,
      items: enrichedItems,
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[orders:id] error', e)
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
  }
}
