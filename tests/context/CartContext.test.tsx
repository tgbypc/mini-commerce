import React, { forwardRef, useImperativeHandle } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { CartProvider, useCart } from '@/context/CartContext'
import { server } from '../mocks/server'

type TestUser = {
  getIdToken: () => Promise<string | undefined>
}

type CartContextValue = ReturnType<typeof useCart>

const authState = {
  user: null as TestUser | null,
  loading: false,
  role: null as 'admin' | 'user' | null,
  emailLogin: vi.fn(),
  logout: vi.fn(),
}

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

const STORAGE_KEY = 'mini-cart-v1'
const LEGACY_KEY = 'mc_cart'

const CartConsumer = forwardRef<CartContextValue>((_, ref) => {
  const value = useCart()
  useImperativeHandle(ref, () => value)
  return (
    <div>
      <span data-testid="count">{value.count}</span>
      <span data-testid="total">{value.total}</span>
      <span data-testid="items">{JSON.stringify(value.state.items)}</span>
    </div>
  )
})

CartConsumer.displayName = 'CartConsumer'

function renderCart() {
  const ref = React.createRef<CartContextValue>()
  render(
    <CartProvider>
      <CartConsumer ref={ref} />
    </CartProvider>
  )
  return ref
}

describe('CartContext', () => {
  beforeEach(() => {
    localStorage.clear()
    authState.user = null
    authState.role = null
    authState.emailLogin.mockReset()
    authState.logout.mockReset()
  })

  it('hydrates from localStorage and persists subsequent changes', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items: [
          {
            productId: 'p1',
            title: 'Nordic Mug',
            price: 12,
            qty: 2,
          },
        ],
      })
    )

    const ref = renderCart()

    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe('2')
    )
    expect(screen.getByTestId('total').textContent).toBe('24')

    await act(async () => {
      await ref.current?.add(
        { productId: 'p2', title: 'Aurora Plate', price: 18 },
        1
      )
    })

    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe('3')
    )

    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || 'null'
    ) as { items?: Array<{ productId: string; qty: number }> } | null
    expect(stored?.items?.map((it) => ({ id: it.productId, qty: it.qty }))).toEqual(
      [
        { id: 'p1', qty: 2 },
        { id: 'p2', qty: 1 },
      ]
    )
  })

  it('falls back to legacy storage key and migrates to the new key', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        items: [
          {
            productId: 'legacy-1',
            title: 'Legacy Lamp',
            price: 50,
            qty: 1,
          },
        ],
      })
    )

    renderCart()

    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe('1')
    )
    expect(
      screen.getByTestId('items').textContent
    ).toContain('legacy-1')

    await waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    )
  })

  it('responds to storage events from other tabs', async () => {
    renderCart()

    expect(screen.getByTestId('count').textContent).toBe('0')

    const payload = JSON.stringify({
      items: [
        {
          productId: 'shared-1',
          title: 'Shared Chair',
          price: 199,
          qty: 1,
        },
      ],
    })

    await act(async () => {
      localStorage.setItem(STORAGE_KEY, payload)
      const event = new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: payload,
      })
      window.dispatchEvent(event)
    })

    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe('1')
    )
    expect(
      screen.getByTestId('items').textContent
    ).toContain('shared-1')
  })

  it('throttles duplicate add calls within 300ms window', async () => {
    const ref = renderCart()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)

      await act(async () => {
        await ref.current?.add(
          { productId: 'dup', title: 'Duplicated', price: 5 },
          1
        )
      })
      expect(screen.getByTestId('count').textContent).toBe('1')

      vi.setSystemTime(299)
      await act(async () => {
        await ref.current?.add(
          { productId: 'dup', title: 'Duplicated', price: 5 },
          1
        )
      })
      expect(screen.getByTestId('count').textContent).toBe('1')

      vi.setSystemTime(350)
      await act(async () => {
        await ref.current?.add(
          { productId: 'dup', title: 'Duplicated', price: 5 },
          1
        )
      })
      expect(screen.getByTestId('count').textContent).toBe('2')
    } finally {
      vi.useRealTimers()
    }
  })

  it('prefers server cart when user logs in with existing remote data', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items: [
          {
            productId: 'local-1',
            title: 'Local Item',
            price: 10,
            qty: 3,
          },
        ],
      })
    )

    authState.user = {
      getIdToken: vi.fn().mockResolvedValue('token-123'),
    }

    const remoteItems = [
      {
        productId: 'remote-1',
        title: 'Remote Product',
        price: 42,
        qty: 1,
      },
    ]

    server.use(
      http.get('/api/user/cart', async ({ request }) => {
        expect(request.headers.get('authorization')).toBe(
          'Bearer token-123'
        )
        return HttpResponse.json({ items: remoteItems })
      })
    )

    renderCart()

    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe('1')
    )
    expect(screen.getByTestId('items').textContent).toContain('remote-1')

    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || 'null'
    ) as { items?: Array<{ productId: string }> } | null
    expect(stored?.items).toEqual(
      remoteItems.map((it) => ({
        productId: it.productId,
        title: it.title,
        price: it.price,
        qty: it.qty,
      }))
    )
  })

  it('pushes local cart to server when remote cart is empty', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items: [
          {
            productId: 'local-1',
            title: 'Local Alpha',
            price: 15,
            qty: 2,
          },
          {
            productId: 'local-2',
            title: 'Local Beta',
            price: 20,
            qty: 1,
          },
        ],
      })
    )

    authState.user = {
      getIdToken: vi.fn().mockResolvedValue('token-xyz'),
    }

    type UpdatePayload = { productId: string; qty: number }
    const updatePayloads: UpdatePayload[] = []
    server.use(
      http.get('/api/user/cart', async ({ request }) => {
        expect(request.headers.get('authorization')).toBe(
          'Bearer token-xyz'
        )
        return HttpResponse.json({ items: [] })
      }),
      http.post('/api/user/cart/update', async ({ request }) => {
        updatePayloads.push((await request.json()) as UpdatePayload)
        return HttpResponse.json({ ok: true })
      })
    )

    renderCart()

    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe('3')
    )
    expect(
      screen.getByTestId('items').textContent
    ).toContain('local-1')
    expect(
      screen.getByTestId('items').textContent
    ).toContain('local-2')

    await waitFor(() =>
      expect(updatePayloads).toHaveLength(2)
    )
    expect(updatePayloads).toEqual([
      { productId: 'local-1', qty: 2 },
      { productId: 'local-2', qty: 1 },
    ])
  })
})
