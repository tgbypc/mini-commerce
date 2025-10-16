import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/products/route'

type DocData = Record<string, unknown>
type DocSnapshot = {
  id: string
  exists: boolean
  data: () => DocData
  get: (field: string) => unknown
}

type QueryMock = {
  where: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  startAfter: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  doc: ReturnType<typeof vi.fn>
}

const state = vi.hoisted(() => ({
  queryHandlers: [] as Array<() => Promise<{ docs: DocSnapshot[] }>>,
  docStore: new Map<string, DocSnapshot>(),
  queries: [] as QueryMock[],
  startAfterArgs: [] as DocSnapshot[],
}))

function makeDoc(id: string, data: DocData): DocSnapshot {
  return {
    id,
    exists: true,
    data: () => data,
    get: (field: string) => (data as Record<string, unknown>)[field],
  }
}

function makeSnapshot(...docs: DocSnapshot[]) {
  return { docs }
}

vi.mock('@/lib/firebaseAdmin', () => {
  function createCollection(): QueryMock {
    const query: QueryMock = {
      where: vi.fn(() => query),
      orderBy: vi.fn(() => query),
      limit: vi.fn(() => query),
      startAfter: vi.fn((doc: DocSnapshot) => {
        state.startAfterArgs.push(doc)
        return query
      }),
      get: vi.fn(async () => {
        if (state.queryHandlers.length === 0) {
          return { docs: [] }
        }
        const handler = state.queryHandlers.shift()!
        return handler()
      }),
      doc: vi.fn((id: string) => ({
        get: vi.fn(async () =>
          state.docStore.get(id) ?? { exists: false, data: () => ({}) }
        ),
      })),
    }
    state.queries.push(query)
    return query
  }
  return {
    adminDb: {
      collection: vi.fn(createCollection),
    },
    FieldPath: {
      documentId: () => '__documentId__',
    },
  }
})

describe('/api/products GET', () => {
  beforeEach(() => {
    state.queryHandlers.length = 0
    state.docStore.clear()
    state.queries.length = 0
    state.startAfterArgs.length = 0
  })

  it('returns localized products with next cursor', async () => {
    state.queryHandlers.push(async () =>
      makeSnapshot(
        makeDoc('prod-1', {
          title_en: 'Nordic Chair',
          description_en: 'Comfortable chair',
          category: 'furniture',
          brand: 'NordForm',
          price: 299,
          thumbnail: '/chair.jpg',
          createdAt: 1700000000000,
        }),
        makeDoc('prod-2', {
          title_en: 'Aurora Sofa',
          description_en: 'Soft sofa',
          category: 'furniture',
          price: 899,
          thumbnail: '/sofa.jpg',
          createdAt: 1700000100000,
        })
      )
    )

    const response = await GET(
      new Request('https://shop.example/api/products?sort=price-asc&limit=2&locale=en')
    )
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.items).toEqual([
      expect.objectContaining({
        id: 'prod-1',
        title: 'Nordic Chair',
        description: 'Comfortable chair',
        price: 299,
        category: 'furniture',
        thumbnail: '/chair.jpg',
      }),
      expect.objectContaining({
        id: 'prod-2',
        title: 'Aurora Sofa',
        price: 899,
      }),
    ])
    expect(body.count).toBe(2)
    expect(body.nextCursor).toBeTruthy()

    const decoded = JSON.parse(
      Buffer.from(body.nextCursor as string, 'base64').toString('utf8')
    ) as { id: string; k: string; d: string; v: unknown }
    expect(decoded).toMatchObject({
      id: 'prod-2',
      k: 'price',
      d: 'asc',
      v: 899,
    })
  })

  it('falls back to client filtering when primary query fails', async () => {
    state.queryHandlers.push(async () => {
      throw new Error('missing index')
    })
    state.queryHandlers.push(async () =>
      makeSnapshot(
        makeDoc('prod-a', {
          title: 'Smart Speaker',
          category: 'electronics',
          price: 199,
        }),
        makeDoc('prod-b', {
          title: 'Kitchen Mixer',
          category: 'kitchen',
          price: 149,
        })
      )
    )

    const response = await GET(
      new Request(
        'https://shop.example/api/products?category=electronics&q=smart&sort=title-asc'
      )
    )
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.items).toEqual([
      expect.objectContaining({
        id: 'prod-a',
        title: 'Smart Speaker',
        category: 'electronics',
      }),
    ])
    expect(body.nextCursor).toBeNull()
  })

  it('applies cursor startAfter when provided', async () => {
    const cursorDoc = makeDoc('cursor-prod', {
      title_en: 'Cursor Item',
      price: 100,
      createdAt: 1700000200000,
    })
    state.docStore.set('cursor-prod', cursorDoc)
    state.queryHandlers.push(async () =>
      makeSnapshot(
        makeDoc('prod-3', {
          title_en: 'After Cursor',
          price: 150,
          createdAt: 1700000300000,
        })
      )
    )

    const cursorPayload = {
      k: 'createdAt',
      d: 'desc',
      v: 1700000200000,
      id: 'cursor-prod',
    }
    const cursor = Buffer.from(JSON.stringify(cursorPayload), 'utf8').toString('base64')

    const response = await GET(
      new Request(
        `https://shop.example/api/products?cursor=${encodeURIComponent(cursor)}&sort=createdAt-desc`
      )
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe('prod-3')
    expect(state.startAfterArgs).toHaveLength(1)
    expect(state.startAfterArgs[0].id).toBe('cursor-prod')
  })
})
