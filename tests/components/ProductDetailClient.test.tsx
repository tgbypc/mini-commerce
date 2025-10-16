import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductDetailClient from '@/components/ProductDetailClient'

type SnapshotHandler = {
  next: (snap: { exists: () => boolean; data: () => Record<string, unknown> }) => void
  error: (err: unknown) => void
}

const snapshotHandlers = new Map<string, SnapshotHandler>()

const docMock = vi.fn(
  (_db: unknown, collection: string, id: string) => ({
    path: `${collection}/${id}`,
    collection,
    id,
  })
)

const onSnapshotMock = vi.fn(
  (
    ref: { path: string },
    onNext: SnapshotHandler['next'],
    onError?: SnapshotHandler['error']
  ) => {
    snapshotHandlers.set(ref.path, {
      next: onNext,
      error: onError ?? (() => {}),
    })
    return () => {
      snapshotHandlers.delete(ref.path)
    }
  }
)

vi.mock('firebase/firestore', () => ({
  doc: (...args: Parameters<typeof docMock>) => docMock(...args),
  onSnapshot: (...args: Parameters<typeof onSnapshotMock>) =>
    onSnapshotMock(...args),
}))

type FavoritePayload = {
  productId: string | number
  title?: string
  thumbnail?: string
  price?: number
}

const addMock = vi.fn<
  (_item: FavoritePayload, _qty?: number) => Promise<void>
>(() => Promise.resolve())
const toggleMock = vi.fn<
  (_item: FavoritePayload) => Promise<void>
>(() => Promise.resolve())
const isFavoriteMock = vi.fn(() => false)

vi.mock('@/context/CartContext', () => ({
  useCart: () => ({
    add: addMock,
  }),
}))

const authState: { user: null | { uid: string; email?: string } } = {
  user: null,
}

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    toggle: toggleMock,
    isFavorite: isFavoriteMock,
  }),
}))

let activeLocale: 'en' | 'nb' = 'en'

const translations: Record<string, string> = {
  'product.detail.notFound': 'Ürün bulunamadı',
  'product.detail.toast.loadError': 'Ürün yüklenemedi',
  'product.detail.toast.addSuccess': 'Sepete eklendi',
  'product.detail.toast.addError': 'Sepete eklenemedi',
  'product.detail.toast.favAuth': 'Favori için giriş yapın',
  'product.detail.toast.favError': 'Favori işlemi başarısız',
  'product.detail.actions.addToFavorites': 'Favorilere ekle',
  'product.detail.actions.inFavorites': 'Favorilerde',
  'product.detail.addToCart': 'Sepete ekle',
  'product.detail.addToCartDisabled': 'Stok yok',
  'product.detail.inStock': 'Stokta',
  'product.detail.outOfStock': 'Stokta yok',
  'product.detail.quantity': 'Adet',
  'product.detail.stockLeft': '{count} ürün kaldı',
  'product.detail.collectionFallback': 'Koleksiyon',
  'product.detail.perks.freeReturns': 'Ücretsiz iade',
  'product.detail.perks.secureCheckout': 'Güvenli ödeme',
  'product.detail.perks.support': '7/24 destek',
  'product.specHeading': 'Ürün detayları',
  'product.labels.category': 'Kategori',
  'product.labels.brand': 'Marka',
  'product.labels.price': 'Fiyat',
  'product.labels.stock': 'Stok',
}

vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    locale: activeLocale,
    setLocale: vi.fn(),
    t: (key: string) => translations[key] ?? key,
  }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-testid="mock-image" data-src={src} data-alt={alt} />
  ),
}))

async function ensureListener(productId: string) {
  const key = `products/${productId}`
  await waitFor(() => {
    if (!snapshotHandlers.has(key)) {
      throw new Error('listener not ready')
    }
    return true
  })
  if (!snapshotHandlers.has(key)) {
    throw new Error(`No snapshot handler registered for ${key}`)
  }
}

function emitSnapshot(
  productId: string,
  payload:
    | { exists: false }
    | { exists: true; data: Record<string, unknown> }
) {
  const key = `products/${productId}`
  const handler = snapshotHandlers.get(key)
  if (!handler) throw new Error(`No snapshot handler registered for ${key}`)
  act(() => {
    handler.next({
      exists: () => payload.exists,
      data: () => ('data' in payload ? payload.data : {}),
    })
  })
}

function emitSnapshotError(productId: string, error: unknown) {
  const key = `products/${productId}`
  const handler = snapshotHandlers.get(key)
  if (!handler) throw new Error(`No snapshot handler registered for ${key}`)
  act(() => {
    handler.error(error)
  })
}

describe('ProductDetailClient', () => {
  beforeEach(() => {
    snapshotHandlers.clear()
    docMock.mockClear()
    onSnapshotMock.mockClear()
    addMock.mockClear()
    toggleMock.mockClear()
    isFavoriteMock.mockClear()
    isFavoriteMock.mockReturnValue(false)
    authState.user = null
    activeLocale = 'en'
  })

  it('renders skeleton while loading initial snapshot', () => {
    const { container } = render(<ProductDetailClient id="p-1" />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('shows not found message when snapshot is missing', async () => {
    render(<ProductDetailClient id="missing" />)

    await ensureListener('missing')
    emitSnapshot('missing', { exists: false })

    expect(
      await screen.findByText('Ürün bulunamadı')
    ).toBeInTheDocument()
  })

  it('shows toast error when snapshot listener fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ProductDetailClient id="err" />)

    await ensureListener('err')
    emitSnapshotError('err', new Error('permission-denied'))

    const { toast } = await import('react-hot-toast')
    expect(toast.error).toHaveBeenCalledWith('Ürün yüklenemedi')
    expect(
      await screen.findByText('Ürün bulunamadı')
    ).toBeInTheDocument()
    errorSpy.mockRestore()
  })

  it('adds product to cart with selected quantity', async () => {
    authState.user = { uid: 'user-1', email: 'user@example.com' }
    addMock.mockResolvedValueOnce(undefined)

    const user = userEvent.setup()
    render(<ProductDetailClient id="prod-1" />)

    await ensureListener('prod-1')
    emitSnapshot('prod-1', {
      exists: true,
      data: {
        id: 'prod-1',
        title_en: 'Scandinavian Chair',
        price: 220,
        thumbnail: '/chair.png',
        stock: 5,
        brand: 'Nordic Co',
        category: 'furniture',
        description_en: 'A relaxing chair.',
      },
    })

    const quantitySelect = await screen.findByRole('combobox', {
      name: 'Adet',
    })
    await user.selectOptions(quantitySelect, '2')

    const addButton = screen.getByRole('button', { name: 'Sepete ekle' })
    await user.click(addButton)

    expect(addMock).toHaveBeenCalledWith(
      {
        productId: 'prod-1',
        title: 'Scandinavian Chair',
        price: 220,
        thumbnail: '/chair.png',
      },
      2
    )

    const { toast } = await import('react-hot-toast')
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Sepete eklendi')
    })
  })

  it('prevents favorite toggle when user is not authenticated', async () => {
    authState.user = null

    const user = userEvent.setup()
    render(<ProductDetailClient id="prod-2" />)

    await ensureListener('prod-2')
    emitSnapshot('prod-2', {
      exists: true,
      data: {
        id: 'prod-2',
        title_en: 'Nordic Lamp',
        price: 89,
      },
    })

    const favButton = await screen.findByRole('button', {
      name: /Favorilere ekle/,
    })

    await user.click(favButton)

    const { toast } = await import('react-hot-toast')
    expect(toast.error).toHaveBeenCalledWith('Favori için giriş yapın')
    expect(toggleMock).not.toHaveBeenCalled()
  })

  it('toggles favorite for authenticated user', async () => {
    authState.user = { uid: 'user-99' }
    toggleMock.mockResolvedValueOnce()
    isFavoriteMock.mockReturnValueOnce(false)

    const user = userEvent.setup()
    render(<ProductDetailClient id="prod-3" />)

    await ensureListener('prod-3')
    emitSnapshot('prod-3', {
      exists: true,
      data: {
        id: 'prod-3',
        title_en: 'Minimal Desk',
        price: 399,
        thumbnail: '/desk.png',
      },
    })

    const favButton = await screen.findByRole('button', {
      name: /Favorilere ekle/,
    })

    await user.click(favButton)

    expect(toggleMock).toHaveBeenCalledWith({
      productId: 'prod-3',
      title: 'Minimal Desk',
      thumbnail: '/desk.png',
      price: 399,
    })

    const { toast } = await import('react-hot-toast')
    expect(toast.error).not.toHaveBeenCalled()
  })
})
