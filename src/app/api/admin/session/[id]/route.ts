import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'



export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string | string[] }> }
) {
  try {
    const { id } = await params
    const sessionId = Array.isArray(id) ? id[0] : id
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
