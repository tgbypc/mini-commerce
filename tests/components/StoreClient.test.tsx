import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import StoreClient from '@/components/store/StoreClient'
import { server } from '../mocks/server'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
  }: {
    src: string
    alt: string
  }) => <span data-testid="mock-image" data-src={src} data-alt={alt} />,
}))

const translations: Record<string, string> = {
  'store.categories.title': 'Kategoriler',
  'store.categories.subtitle': 'Ürün gruplarımızı keşfedin',
  'store.categories.cta': 'Tümünü Gör',
  'store.categories.list.cta': 'Keşfet',
  'store.bestSellers.title': 'Çok Satanlar',
  'store.bestSellers.subtitle': 'Popüler seçimler',
  'store.bestSellers.cta': 'İncele',
  'store.bestSellers.noImage': 'Görsel yok',
  'store.bestSellers.unknownCategory': 'Kategori yok',
  'store.bestSellers.empty': 'Listede ürün yok',
  'store.bestSellers.error': 'Ürünler yüklenemedi',
  'home.clear': 'Temizle',
  'store.categories.list.home.label': 'Ev',
  'store.categories.list.home.description': 'Ev & yaşam ürünleri',
  'store.categories.list.electronics.label': 'Elektronik',
  'store.categories.list.electronics.description': 'Teknoloji ürünleri',
}

vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => translations[key] ?? key,
  }),
}))

type Preview = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  price: number
  thumbnail?: string | null
}

const buildProduct = (
  id: string,
  overrides: Partial<Preview> = {}
): Preview => ({
  id,
  title: `Ürün ${id}`,
  description: `Açıklama ${id}`,
  category: 'furniture',
  price: 199,
  thumbnail: `/thumb-${id}.jpg`,
  ...overrides,
})

const scrollIntoViewMock = vi.fn()

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  })
})

beforeEach(() => {
  scrollIntoViewMock.mockClear()
})

describe('StoreClient', () => {
  it('fetches products on initial load when list is empty', async () => {
    const requests: URL[] = []
    server.use(
      http.get('/api/products', ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        return HttpResponse.json({
          items: [
            buildProduct('remote-1', {
              title: 'Nordic Koltuk',
              category: 'furniture',
            }),
          ],
        })
      })
    )

    render(
      <StoreClient
        initialProducts={[]}
        initialLocale="en"
        availableCategories={['furniture', 'lighting', 'electronics']}
      />
    )

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].searchParams.get('locale')).toBe('en')
    expect(
      await screen.findByRole('heading', { name: /Nordic Koltuk/i })
    ).toBeInTheDocument()
  })

  it('applies category group filter and requests matching categories', async () => {
    const requests: URL[] = []
    server.use(
      http.get('/api/products', ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        const categories = url.searchParams.get('categories')
        if (categories && categories.includes('furniture')) {
          return HttpResponse.json({
            items: [
              buildProduct('home-1', {
                title: 'Ev Koleksiyonu Masa',
                category: 'furniture',
              }),
              buildProduct('home-2', {
                title: 'Ev Koleksiyonu Lamba',
                category: 'lighting',
              }),
            ],
          })
        }
        return HttpResponse.json({
          items: [
            buildProduct('default-1', { title: 'Varsayılan Ürün' }),
            buildProduct('default-2', { title: 'Teknoloji Ürünü', category: 'electronics' }),
          ],
        })
      })
    )

    const user = userEvent.setup()
    render(
      <StoreClient
        initialProducts={[
          buildProduct('default-1', { title: 'Varsayılan Ürün' }),
          buildProduct('default-2', {
            title: 'Teknoloji Ürünü',
            category: 'electronics',
          }),
        ]}
        initialLocale="en"
        availableCategories={[
          'furniture',
          'lighting',
          'kitchen',
          'electronics',
        ]}
      />
    )

    const homeButton = await screen.findByRole('button', { name: /Ev/i })
    await user.click(homeButton)

    await waitFor(() => expect(requests.length).toBeGreaterThan(0))
    const last = requests.at(-1)!
    const requestedCategories = (last.searchParams.get('categories') ?? '')
      .split(',')
      .filter(Boolean)

    expect(new Set(requestedCategories)).toEqual(
      new Set(['furniture', 'lighting', 'kitchen'])
    )
    expect(
      await screen.findByRole('heading', { name: 'Ev Koleksiyonu Masa' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Ev Koleksiyonu Lamba' })
    ).toBeInTheDocument()
  })

  it('shows error message when fetch fails', async () => {
    server.use(
      http.get('/api/products', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 })
      )
    )

    render(
      <StoreClient
        initialProducts={[]}
        initialLocale="en"
        availableCategories={['furniture', 'electronics']}
      />
    )

    expect(
      await screen.findByText('Ürünler yüklenemedi')
    ).toBeInTheDocument()
  })
})
