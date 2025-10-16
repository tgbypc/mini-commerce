import type Stripe from 'stripe'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/checkout/route'

vi.mock('server-only', () => ({}))

const stripeCreateMock = vi.hoisted(() =>
  vi.fn<
    (
      payload: Stripe.Checkout.SessionCreateParams
    ) => Promise<{ url?: string }>
  >()
)

const getDocMock = vi.hoisted(() => vi.fn())
const docMock = vi.hoisted(() =>
  vi.fn(() => ({
    get: getDocMock,
  }))
)
const collectionMock = vi.hoisted(() =>
  vi.fn(() => ({
    doc: docMock,
  }))
)

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: stripeCreateMock,
      },
    },
  },
}))

vi.mock('@/lib/firebaseAdmin', () => ({
  adminDb: {
    collection: collectionMock,
  },
}))

describe('/api/checkout POST', () => {
  beforeEach(() => {
    stripeCreateMock.mockReset()
    getDocMock.mockReset()
    docMock.mockReset()
    docMock.mockImplementation(() => ({
      get: getDocMock,
    }))
    collectionMock.mockReset()
    collectionMock.mockImplementation(() => ({
      doc: docMock,
    }))
    process.env.NEXT_PUBLIC_SITE_URL = 'https://shop.example'
  })

  it('validates request body and returns 400 for invalid payload', async () => {
    const request = new Request('https://shop.example/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: [] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(stripeCreateMock).not.toHaveBeenCalled()
  })

  it('returns 500 when product document is missing', async () => {
    getDocMock.mockResolvedValueOnce({ exists: false })

    const request = new Request('https://shop.example/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://origin.test',
      },
      body: JSON.stringify({
        items: [{ productId: 'missing', quantity: 1 }],
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('Product not found')
    expect(stripeCreateMock).not.toHaveBeenCalled()
  })

  it('creates checkout session with localized product data', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        price: 129.5,
        title_nb: 'Norsk tittel',
        title_en: 'English title',
      }),
    })
    stripeCreateMock.mockResolvedValueOnce({
      url: 'https://stripe.test/session/123',
    })

    const request = new Request('https://shop.example/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://origin.test',
      },
      body: JSON.stringify({
        items: [{ productId: 'prod-1', quantity: 2 }],
        uid: 'user-1',
        email: 'customer@example.com',
        locale: 'nb',
        shippingMethod: 'express',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ url: 'https://stripe.test/session/123' })

    expect(collectionMock).toHaveBeenCalledWith('products')
    expect(docMock).toHaveBeenCalledWith('prod-1')
    expect(getDocMock).toHaveBeenCalled()
    expect(stripeCreateMock).toHaveBeenCalledTimes(1)
    const payload = stripeCreateMock.mock.calls[0][0]

    expect(payload).toMatchObject({
      mode: 'payment',
      locale: 'nb',
      client_reference_id: 'user-1',
      customer_email: 'customer@example.com',
      metadata: { shippingMethod: 'express', uid: 'user-1' },
      success_url: 'https://origin.test/success?id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://origin.test/cart',
    })
    expect(payload.line_items).toEqual([
      {
        quantity: 2,
        price_data: {
          currency: 'usd',
          unit_amount: 12950,
          product_data: {
            name: 'Norsk tittel',
            metadata: { productId: 'prod-1' },
          },
        },
      },
    ])
    expect(payload.shipping_options).toHaveLength(2)
  })

  it('returns 500 when stripe session lacks URL', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        price: 20,
        title: 'Generic product',
      }),
    })
    stripeCreateMock.mockResolvedValueOnce({})

    const request = new Request('https://shop.example/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ productId: 'prod-2', quantity: 1 }],
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to create checkout session')
  })
})
