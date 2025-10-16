import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import HomeClient from '@/components/home/HomeClient'
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

vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => key,
  }),
}))

type MockItem = {
  id: string
  title: string
  description?: string
  category?: string
  price: number
  thumbnail?: string
}

function createItem(
  id: string,
  overrides: Partial<MockItem> = {}
): MockItem {
  return {
    id,
    title: `Product ${id}`,
    description: `Description for ${id}`,
    category: 'furniture',
    price: 100,
    thumbnail: `/images/${id}.jpg`,
    ...overrides,
  }
}

describe('HomeClient', () => {
  it('debounces search input before fetching results', async () => {
    const requests: URL[] = []
    server.use(
      http.get('/api/products', ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        return HttpResponse.json({
          items: [createItem('search-result', { title: 'Nordic Lounge Chair' })],
          nextCursor: null,
        })
      })
    )

    const user = userEvent.setup({ delay: 5 })
    render(
      <HomeClient
        initialItems={[createItem('initial')]}
        initialNextCursor={null}
        initialLocale="en"
        availableCategories={['furniture', 'electronics']}
      />
    )

    const searchBox = screen.getByPlaceholderText('Search products')
    await user.type(searchBox, 'nordic')

    expect(requests).toHaveLength(0)

    await waitFor(
      () => {
        expect(requests).toHaveLength(1)
      },
      { timeout: 1500 }
    )
    expect(requests[0].searchParams.get('q')).toBe('nordic')

    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(requests).toHaveLength(1)
  })

  it('applies quick filter and resets list with matching items', async () => {
    const requests: URL[] = []
    server.use(
      http.get('/api/products', ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        const category = url.searchParams.get('category')
        const items =
          category === 'electronics'
            ? [createItem('phone-1', { title: 'Smart Phone', category: 'electronics' })]
            : [
                createItem('chair-1', { title: 'Nordic Chair' }),
                createItem('desk-1', { title: 'Oak Desk' }),
                createItem('phone-1', { title: 'Smart Phone', category: 'electronics' }),
              ]
        return HttpResponse.json({ items, nextCursor: null })
      })
    )

    const user = userEvent.setup()
    render(
      <HomeClient
        initialItems={[
          createItem('chair-1', { title: 'Nordic Chair' }),
          createItem('desk-1', { title: 'Oak Desk' }),
          createItem('phone-1', { title: 'Smart Phone', category: 'electronics' }),
        ]}
        initialNextCursor={null}
        initialLocale="en"
        availableCategories={['furniture', 'electronics']}
      />
    )

    const electronicsFilter = await screen.findByRole('button', { name: 'Electronics' })
    await user.click(electronicsFilter)

    await waitFor(() => expect(requests.length).toBeGreaterThan(0))
    const last = requests.at(-1)!
    expect(last.searchParams.get('category')).toBe('electronics')

    const cards = screen.getAllByRole('heading', { level: 3 })
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('Smart Phone')
  })

  it('changes sort order and reflects sorted prices', async () => {
    const requests: URL[] = []
    const unsorted = [
      createItem('high', { title: 'Premium Sofa', price: 999 }),
      createItem('mid', { title: 'Desk Lamp', price: 199, category: 'lighting' }),
      createItem('low', { title: 'Coffee Mug', price: 25, category: 'kitchen' }),
    ]
    server.use(
      http.get('/api/products', ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        const sort = url.searchParams.get('sort')
        if (sort === 'price-asc') {
          const sorted = [...unsorted].sort((a, b) => a.price - b.price)
          return HttpResponse.json({ items: sorted, nextCursor: null })
        }
        return HttpResponse.json({ items: unsorted, nextCursor: null })
      })
    )

    const user = userEvent.setup()
    render(
      <HomeClient
        initialItems={unsorted}
        initialNextCursor={null}
        initialLocale="en"
        availableCategories={['furniture', 'lighting', 'kitchen']}
      />
    )

    const sortSelect = screen.getByLabelText('home.sortLabel')
    await user.selectOptions(sortSelect, 'price-asc')

    await waitFor(() => {
      const last = requests.at(-1)
      expect(last?.searchParams.get('sort')).toBe('price-asc')
    })

    const priceTexts = screen.getAllByText(/\$\d+/)
    const prices = priceTexts.map((node) =>
      Number((node.textContent ?? '$0').replace(/[^0-9.]/g, ''))
    )
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
  })

  it('loads additional pages and appends unique items', async () => {
    const requests: URL[] = []
    const allItems = Array.from({ length: 26 }).map((_, index) =>
      createItem(`prod-${index + 1}`, {
        title: `Product ${index + 1}`,
        price: 50 + index,
        category: index % 2 === 0 ? 'furniture' : 'electronics',
      })
    )
    server.use(
      http.get('/api/products', ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        const cursor = url.searchParams.get('cursor')
        if (!cursor) {
          return HttpResponse.json({
            items: allItems.slice(0, 20),
            nextCursor: 'cursor-20',
          })
        }
        return HttpResponse.json({
          items: allItems.slice(20),
          nextCursor: null,
        })
      })
    )

    const user = userEvent.setup()
    render(
      <HomeClient
        initialItems={[]}
        initialNextCursor={null}
        initialLocale="en"
        availableCategories={['furniture', 'electronics']}
      />
    )

    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(20)
    )

    const loadMoreButton = screen.getByRole('button', { name: 'home.loadMore' })
    await user.click(loadMoreButton)

    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(26)
    )
    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(new Set(titles).size).toBe(titles.length)

    expect(
      requests.filter((url) => url.searchParams.get('cursor') === 'cursor-20').length
    ).toBe(1)
  })
})
