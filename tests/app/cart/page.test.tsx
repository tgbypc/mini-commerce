import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import CartPage from '@/app/cart/page'

const pushMock = vi.fn()

const cartState = {
  state: {
    items: [
      {
        productId: 'prod-1',
        title: 'Nordic Chair',
        price: 199,
        qty: 1,
        thumbnail: '/chair.jpg',
      },
    ],
  },
  total: 199,
  incr: vi.fn(),
  decr: vi.fn(),
  remove: vi.fn(),
}

const useCartMock = vi.fn(() => cartState)
let authUser: null | { uid: string; email: string } = null
const useAuthMock = vi.fn(() => ({
  user: authUser,
  loading: false,
  role: null,
  emailLogin: vi.fn(),
  logout: vi.fn(),
}))

let locale: 'en' | 'nb' = 'en'
const translations: Record<string, string> = {
  'cart.checkout.cta': 'Checkout',
  'cart.checkout.loading': 'Processing...',
  'cart.title': 'Your cart',
  'cart.subtitle': 'Items in cart: {items}',
  'cart.count.one': '{count} item',
  'cart.count.other': '{count} items',
  'cart.summary.products': 'Products ({items})',
  'cart.summary.shipping': 'Shipping',
  'cart.summary.shippingTbd': 'Calculated at checkout',
  'cart.summary.subtotal': 'Subtotal',
  'cart.summary.taxNote': 'Tax calculated at checkout',
  'cart.continue': 'Continue shopping',
  'cart.reminder': 'Reminder text',
  'cart.emptyTitle': 'Cart empty',
  'cart.emptyMessage': 'Add products to your cart',
  'cart.emptyCta': 'Browse products',
  'cart.productFallback': 'Product',
  'cart.imageAlt': '{product} image',
  'cart.quantity.decrease': 'Decrease quantity',
  'cart.quantity.increase': 'Increase quantity',
  'cart.remove': 'Remove',
}
const useI18nMock = vi.fn(() => ({
  locale,
  setLocale: vi.fn(),
  t: (key: string) => translations[key] ?? key,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/context/CartContext', () => ({
  useCart: () => useCartMock(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/context/I18nContext', () => ({
  useI18n: () => useI18nMock(),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
  }: {
    src: string
    alt: string
    fill?: boolean
    [key: string]: unknown
  }) => {
    return (
      <span
        data-testid="mock-image"
        data-src={src}
        data-alt={alt}
      />
    )
  },
}))

describe('CartPage checkout flow', () => {
  const originalFetch = global.fetch
  const locationDescriptor = Object.getOwnPropertyDescriptor(
    window,
    'location'
  )

  beforeEach(() => {
    cartState.state.items = [
      {
        productId: 'prod-1',
        title: 'Nordic Chair',
        price: 199,
        qty: 1,
        thumbnail: '/chair.jpg',
      },
    ]
    cartState.total = 199
    cartState.incr.mockReset()
    cartState.decr.mockReset()
    cartState.remove.mockReset()
    useCartMock.mockClear()
    authUser = null
    pushMock.mockClear()
    global.fetch = vi.fn()
    locale = 'en'
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (locationDescriptor) {
      Object.defineProperty(window, 'location', locationDescriptor)
    }
  })

  it('guides guest users to login and skips checkout request', async () => {
    const user = userEvent.setup()
    render(<CartPage />)

    const checkoutButton = screen.getByRole('button', { name: 'Checkout' })

    await user.click(checkoutButton)
    const { toast } = await import('react-hot-toast')

    expect(toast.error).toHaveBeenCalledWith(
      'Please sign in to complete checkout'
    )
    expect(pushMock).toHaveBeenCalledWith('/user/login?next=/cart')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('submits checkout request and redirects when URL is returned', async () => {
    authUser = { uid: 'user-1', email: 'user@example.com' }
    locale = 'nb'

    let resolveFetch:
      | ((value: { ok: boolean; json: () => Promise<{ url: string }> }) => void)
      | undefined
    ;(global.fetch as unknown as Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = (value) => resolve(value as never)
        })
    )

    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        assign: vi.fn(),
      },
    })
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      get: () => '',
      set: hrefSetter,
    })

    const user = userEvent.setup()
    render(<CartPage />)

    const checkoutButton = screen.getByRole('button', { name: 'Checkout' })

    const clickPromise = user.click(checkoutButton)

    await waitFor(() => expect(checkoutButton).toBeDisabled())
    expect(checkoutButton).toHaveTextContent('Processing...')

    resolveFetch?.({
      ok: true,
      json: async () => ({
        url: 'https://checkout.test/session/abc',
      }),
    })
    await clickPromise

    const { toast } = await import('react-hot-toast')

    expect(global.fetch).toHaveBeenCalledWith('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
          },
        ],
        uid: 'user-1',
        email: 'user@example.com',
        locale: 'nb',
      }),
    })
    expect(hrefSetter).toHaveBeenCalledWith(
      'https://checkout.test/session/abc'
    )
    expect(checkoutButton).not.toBeDisabled()
    expect(checkoutButton).toHaveTextContent('Checkout')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('shows error toast when checkout API fails', async () => {
    authUser = { uid: 'user-2', email: 'customer@example.com' }
    ;(global.fetch as unknown as Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'stripe-failure' }),
    })

    const user = userEvent.setup()
    render(<CartPage />)

    await user.click(screen.getByRole('button', { name: 'Checkout' }))
    const { toast } = await import('react-hot-toast')

    expect(toast.error).toHaveBeenCalledWith('stripe-failure')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
