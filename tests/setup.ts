import '@testing-library/jest-dom/vitest'
import 'whatwg-fetch'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './mocks/server'
import { resetMockProducts } from './mocks/handlers'

beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error',
  })
})

afterEach(() => {
  server.resetHandlers()
  resetMockProducts()
  vi.restoreAllMocks()
})

afterAll(() => {
  server.close()
})

vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}))

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>(
    'next/navigation'
  )
  const useRouterMock = vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }))
  const usePathnameMock = vi.fn(() => '/')
  return {
    ...actual,
    useRouter: useRouterMock,
    usePathname: usePathnameMock,
    useSearchParams: () => new URLSearchParams(),
  }
})

vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {
    currentUser: null,
  },
}))

vi.mock('@/lib/firebaseAdmin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      doc: vi.fn().mockReturnThis(),
      get: vi.fn(async () => ({
        docs: [],
        empty: true,
      })),
      add: vi.fn(),
      update: vi.fn(),
    })),
  },
  auth: {
    verifyIdToken: vi.fn(async () => ({ uid: 'test-user' })),
  },
  FieldValue: {
    serverTimestamp: vi.fn(() => new Date()),
    delete: vi.fn(),
  },
  FieldPath: {
    documentId: () => 'documentId',
  },
}))

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))
