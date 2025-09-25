import { NextResponse, type NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawId = params?.id
    const sessionId = Array.isArray(rawId) ? rawId[0] : rawId
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session id' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product'],
    })

    return NextResponse.json({ session })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load session'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
