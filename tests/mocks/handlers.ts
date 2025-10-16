import { http, HttpResponse } from 'msw'

export type MockProduct = {
  id: string
  title: string
  title_nb?: string
  description: string
  description_nb?: string
  category: string
  brand: string
  price: number
  thumbnail?: string
  stock?: number
  createdAt: string
}

const baseProducts: MockProduct[] = [
  {
    id: 'prod_nordic_chair',
    title: 'Nordic Lounge Chair',
    title_nb: 'Nordisk Lounge Stol',
    description: 'A deep-blue lounge chair with solid oak legs.',
    description_nb: 'En dyp blå loungestol med solide eikeben.',
    category: 'furniture',
    brand: 'NordForm',
    price: 249,
    thumbnail: '/images/products/nordic-chair.jpg',
    stock: 8,
    createdAt: '2024-03-16T10:30:00.000Z',
  },
  {
    id: 'prod_aurora_sofa',
    title: 'Aurora Linen Sofa',
    title_nb: 'Aurora Linsofa',
    description: 'Modular three-seater sofa in warm linen fabric.',
    description_nb: 'Modulær tresetersofa i varmt linstoff.',
    category: 'furniture',
    brand: 'Aurora Studio',
    price: 1299,
    thumbnail: '/images/products/aurora-sofa.jpg',
    stock: 5,
    createdAt: '2024-03-04T08:15:00.000Z',
  },
  {
    id: 'prod_glass_kettle',
    title: 'Clarity Glass Kettle',
    title_nb: 'Klarhet Glasskoker',
    description: 'Temperature controlled kettle with glass body.',
    description_nb: 'Vannkoker i glass med temperaturkontroll.',
    category: 'kitchen',
    brand: 'Clarity Labs',
    price: 89,
    thumbnail: '/images/products/glass-kettle.jpg',
    stock: 24,
    createdAt: '2024-02-22T13:05:00.000Z',
  },
  {
    id: 'prod_micro_roaster',
    title: 'Micro Coffee Roaster',
    title_nb: 'Mikro Kaffebrenner',
    description: 'Countertop smart roaster with preset profiles.',
    description_nb: 'Bordmodell kaffebrenner med smarte profiler.',
    category: 'kitchen',
    brand: 'Roastly',
    price: 459,
    thumbnail: '/images/products/micro-roaster.jpg',
    stock: 6,
    createdAt: '2024-01-30T18:50:00.000Z',
  },
  {
    id: 'prod_ember_lamp',
    title: 'Ember Table Lamp',
    title_nb: 'Ember Bordlampe',
    description: 'Matte ceramic table lamp with warm LED glow.',
    description_nb: 'Bordlampe i matt keramikk med varm LED-glød.',
    category: 'lighting',
    brand: 'Glow Line',
    price: 159,
    thumbnail: '/images/products/ember-lamp.jpg',
    stock: 18,
    createdAt: '2023-12-18T09:45:00.000Z',
  },
  {
    id: 'prod_nimbus_headphones',
    title: 'Nimbus Wireless Headphones',
    title_nb: 'Nimbus Trådløse Hodetelefoner',
    description: 'Noise cancelling headphones with 40h battery.',
    description_nb: 'Støydempende hodetelefoner med 40t batteri.',
    category: 'electronics',
    brand: 'Nimbus Audio',
    price: 279,
    thumbnail: '/images/products/nimbus-headphones.jpg',
    stock: 14,
    createdAt: '2024-04-05T11:10:00.000Z',
  },
  {
    id: 'prod_haze_diffuser',
    title: 'Haze Ultrasonic Diffuser',
    title_nb: 'Haze Ultrasonisk Diffuser',
    description: 'Quiet diffuser with ambient light ring.',
    description_nb: 'Stillegående diffuser med ambient lysring.',
    category: 'wellness',
    brand: 'Harbor',
    price: 72,
    thumbnail: '/images/products/haze-diffuser.jpg',
    stock: 32,
    createdAt: '2024-02-08T07:25:00.000Z',
  },
  {
    id: 'prod_peak_jacket',
    title: 'Peak Performance Jacket',
    title_nb: 'Peak Ytelsesjakke',
    description: 'Waterproof shell with breathable lining.',
    description_nb: 'Vanntett skalljakke med pustende fôr.',
    category: 'apparel',
    brand: 'Peak Nordic',
    price: 329,
    thumbnail: '/images/products/peak-jacket.jpg',
    stock: 11,
    createdAt: '2024-03-28T06:40:00.000Z',
  },
  {
    id: 'prod_flux_bottle',
    title: 'Flux Smart Bottle',
    title_nb: 'Flux Smartflaske',
    description: 'Hydration tracking bottle with UV sterilizer.',
    description_nb: 'Drikkeflaske som sporer hydrering og UV-steriliserer.',
    category: 'fitness',
    brand: 'Flux Labs',
    price: 119,
    thumbnail: '/images/products/flux-bottle.jpg',
    stock: 21,
    createdAt: '2024-01-11T15:55:00.000Z',
  },
  {
    id: 'prod_polar_blanket',
    title: 'Polar Wool Blanket',
    title_nb: 'Polar Ullpledd',
    description: 'Handwoven merino wool blanket with fringed edge.',
    description_nb: 'Håndvevd merinoullpledd med frynser.',
    category: 'home-decor',
    brand: 'Polar Loom',
    price: 189,
    thumbnail: '/images/products/polar-blanket.jpg',
    stock: 27,
    createdAt: '2023-11-21T20:05:00.000Z',
  },
]

let productFixtures: MockProduct[] = [...baseProducts]

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function normalizeLocale(value: string | null | undefined) {
  const normalized = normalize(value)
  return normalized === 'nb' || normalized === 'nb-no' ? 'nb' : 'en'
}

function parseLimit(value: string | null) {
  const n = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(n)) return 20
  return Math.max(1, Math.min(50, n))
}

function resolveSortKey(value: string | null) {
  const raw = (value ?? 'createdAt-desc').toLowerCase().replace(/_/g, '-')
  const allowed = new Set([
    'createdat-asc',
    'createdat-desc',
    'price-asc',
    'price-desc',
    'title-asc',
    'title-desc',
  ])
  if (allowed.has(raw)) return raw as typeof raw
  return 'createdat-desc'
}

function buildProductResponse(url: URL) {
  const limit = parseLimit(url.searchParams.get('limit'))
  const locale = normalizeLocale(url.searchParams.get('locale'))
  const sortKey = resolveSortKey(url.searchParams.get('sort'))
  const q = normalize(url.searchParams.get('q'))

  const categoryParam = url.searchParams.get('category')
  const categoriesParam = url.searchParams.get('categories')
  const requestedCategories = [
    ...new Set(
      [
        ...(categoryParam ? [categoryParam] : []),
        ...(categoriesParam ? categoriesParam.split(',') : []),
      ]
        .map((item) => normalize(item))
        .filter(Boolean)
    ),
  ]

  const cursorId = url.searchParams.get('cursor')

  let filtered = productFixtures

  if (requestedCategories.length > 0) {
    const categorySet = new Set(requestedCategories)
    filtered = filtered.filter((product) =>
      categorySet.has(normalize(product.category))
    )
  }

  if (q) {
    const terms = q.split(/\s+/).filter(Boolean)
    filtered = filtered.filter((product) => {
      const haystack = [
        product.id,
        product.title,
        product.title_nb,
        product.description,
        product.description_nb,
        product.brand,
        product.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
  }

  const sorted = [...filtered]
  const collator = new Intl.Collator(locale === 'nb' ? 'nb' : 'en', {
    sensitivity: 'base',
  })

  sorted.sort((a, b) => {
    switch (sortKey) {
      case 'price-asc':
        return a.price - b.price || a.id.localeCompare(b.id)
      case 'price-desc':
        return b.price - a.price || a.id.localeCompare(b.id)
      case 'title-asc': {
        const aTitle = locale === 'nb' && a.title_nb ? a.title_nb : a.title
        const bTitle = locale === 'nb' && b.title_nb ? b.title_nb : b.title
        const cmp = collator.compare(aTitle, bTitle)
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
      }
      case 'title-desc': {
        const aTitle = locale === 'nb' && a.title_nb ? a.title_nb : a.title
        const bTitle = locale === 'nb' && b.title_nb ? b.title_nb : b.title
        const cmp = collator.compare(bTitle, aTitle)
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
      }
      case 'createdat-asc': {
        const cmp =
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
      }
      case 'createdat-desc':
      default: {
        const cmp =
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
      }
    }
  })

  let startIndex = 0
  if (cursorId) {
    const index = sorted.findIndex((item) => item.id === cursorId)
    if (index >= 0) startIndex = index + 1
  }

  const page = sorted.slice(startIndex, startIndex + limit)
  const lastItem = page[page.length - 1] || null
  const hasMore = startIndex + page.length < sorted.length
  const nextCursor = hasMore && lastItem ? lastItem.id : null

  const responseItems = page.map((product) => ({
    id: product.id,
    title: locale === 'nb' && product.title_nb ? product.title_nb : product.title,
    description:
      locale === 'nb' && product.description_nb
        ? product.description_nb
        : product.description,
    category: product.category,
    brand: product.brand,
    price: product.price,
    thumbnail: product.thumbnail ?? '',
    stock: product.stock,
    createdAt: product.createdAt,
  }))

  return {
    items: responseItems,
    nextCursor,
    count: responseItems.length,
  }
}

export function getMockProducts(): MockProduct[] {
  return [...productFixtures]
}

export function setMockProducts(
  next:
    | MockProduct[]
    | ((current: MockProduct[]) => MockProduct[])
): MockProduct[] {
  productFixtures =
    typeof next === 'function' ? [...next([...productFixtures])] : [...next]
  return getMockProducts()
}

export function resetMockProducts(): MockProduct[] {
  productFixtures = [...baseProducts]
  return getMockProducts()
}

export function addMockProduct(product: MockProduct): MockProduct[] {
  productFixtures = [...productFixtures, product]
  return getMockProducts()
}

export function buildProductCursor(id: string | null): string | null {
  if (!id) return null
  return id
}

export const handlers = [
  http.get('/api/products', ({ request }) => {
    const url = new URL(request.url)
    const payload = buildProductResponse(url)
    return HttpResponse.json(payload)
  }),
  http.post('/api/contact', async ({ request }) => {
    await request.json().catch(() => ({}))
    return HttpResponse.json({ ok: true })
  }),
  http.post('/api/checkout', async () => {
    return HttpResponse.json({
      url: '/checkout/session/mock',
      sessionId: 'sess_mock_123',
    })
  }),
  http.get('/api/user/cart', () => {
    return HttpResponse.json({ items: [] })
  }),
  http.post('/api/user/cart/add', async () => {
    return HttpResponse.json({ ok: true })
  }),
  http.post('/api/user/cart/update', async () => {
    return HttpResponse.json({ ok: true })
  }),
  http.post('/api/user/cart/clear', async () => {
    return HttpResponse.json({ ok: true })
  }),
]
