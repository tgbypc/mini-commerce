import React, { useEffect } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FavoritesProvider, useFavorites } from '@/context/FavoritesContext'

type SnapshotHandler = {
  next: (snap: { docs: Array<{ id: string; data: () => unknown }> }) => void
  error: (err: unknown) => void
}

const authState = {
  user: null as null | { uid: string },
}

const snapshotHandlers = new Map<string, SnapshotHandler>()
const setDocMock = vi.fn<
  (
    ref: { path: string },
    data: {
      productId: string
      title: string | null
      thumbnail: string | null
      price: number | null
      addedAt: string
    },
    options: { merge: boolean }
  ) => Promise<void>
>(() => Promise.resolve())
const deleteDocMock = vi.fn<
  (ref: { path: string }) => Promise<void>
>(() => Promise.resolve())

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string, uid: string, sub: string) => ({
    path: `${path}/${uid}/${sub}`,
  }),
  doc: (
    _db: unknown,
    path: string,
    uid: string,
    sub: string,
    id: string
  ) => ({
    path: `${path}/${uid}/${sub}/${id}`,
  }),
  onSnapshot: (
    ref: { path: string },
    next: SnapshotHandler['next'],
    error?: SnapshotHandler['error']
  ) => {
    snapshotHandlers.set(ref.path, {
      next,
      error: error ?? (() => {}),
    })
    return () => snapshotHandlers.delete(ref.path)
  },
  setDoc: (...args: Parameters<typeof setDocMock>) => setDocMock(...args),
  deleteDoc: (...args: Parameters<typeof deleteDocMock>) =>
    deleteDocMock(...args),
  serverTimestamp: () => 'timestamp',
}))

function emitSnapshot(
  uid: string,
  docs: Array<{ id: string; data: () => unknown }>
) {
  const key = `users/${uid}/favorites`
  const handler = snapshotHandlers.get(key)
  if (!handler) throw new Error(`snapshot handler not found for ${key}`)
  handler.next({ docs })
}

function emitSnapshotError(uid: string, err: unknown) {
  const key = `users/${uid}/favorites`
  const handler = snapshotHandlers.get(key)
  if (!handler) throw new Error(`snapshot handler not found for ${key}`)
  handler.error(err)
}

function TestComponent() {
  const favorites = useFavorites()
  useEffect(() => {
    // expose for assertions
    ;(window as { __favorites?: ReturnType<typeof useFavorites> }).__favorites = favorites
  }, [favorites])
  return null
}

function getFavorites() {
  const ctx = (window as { __favorites?: ReturnType<typeof useFavorites> }).__favorites
  if (!ctx) throw new Error('favorites context not ready')
  return ctx
}

describe('FavoritesContext', () => {
  beforeEach(() => {
    snapshotHandlers.clear()
    setDocMock.mockReset()
    deleteDocMock.mockReset()
    authState.user = { uid: 'user-1' }
    ;(window as { __favorites?: ReturnType<typeof useFavorites> }).__favorites = undefined
  })

  it('syncs snapshot items and tracks ids/count', async () => {
    render(
      <FavoritesProvider>
        <TestComponent />
      </FavoritesProvider>
    )

    await waitFor(() => expect(snapshotHandlers.size).toBe(1))

    act(() => {
      emitSnapshot('user-1', [
        {
          id: 'fav-a',
          data: () => ({
            title: 'A Ürün',
            thumbnail: '/a.jpg',
            price: 120,
          }),
        },
        {
          id: 'fav-b',
          data: () => ({
            title: 'B Ürün',
            price: 'not-a-number',
          }),
        },
      ])
    })

    await waitFor(() => {
      const ctx = getFavorites()
      expect(ctx?.items).toHaveLength(2)
      expect(ctx?.isFavorite('fav-a')).toBe(true)
      expect(ctx?.isFavorite('missing')).toBe(false)
      expect(ctx?.count).toBe(2)
    })
  })

  it('adds and removes favorite items via toggle', async () => {
    render(
      <FavoritesProvider>
        <TestComponent />
      </FavoritesProvider>
    )

    await waitFor(() => expect(snapshotHandlers.size).toBe(1))

    act(() => emitSnapshot('user-1', []))

    let ctx = getFavorites()

    await act(async () => {
      await ctx.toggle({
        productId: 'prod-1',
        title: 'Ürün 1',
        price: 50,
      })
    })

    expect(setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1/favorites/prod-1',
      }),
      {
        productId: 'prod-1',
        title: 'Ürün 1',
        thumbnail: null,
        price: 50,
        addedAt: 'timestamp',
      },
      { merge: true }
    )

    act(() =>
      emitSnapshot('user-1', [
        {
          id: 'prod-1',
          data: () => ({
            title: 'Ürün 1',
            price: 50,
          }),
        },
      ])
    )

    await waitFor(() => expect(getFavorites().isFavorite('prod-1')).toBe(true))

    ctx = getFavorites()
    await act(async () => {
      await ctx.toggle({ productId: 'prod-1' })
    })
    expect(deleteDocMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1/favorites/prod-1',
      })
    )
  })

  it('clears items on snapshot error', async () => {
    render(
      <FavoritesProvider>
        <TestComponent />
      </FavoritesProvider>
    )

    await waitFor(() => expect(snapshotHandlers.size).toBe(1))
    act(() =>
      emitSnapshot('user-1', [
        {
          id: 'keep',
          data: () => ({ title: 'Keep' }),
        },
      ])
    )

    await waitFor(() => {
      const ctx = getFavorites()
      expect(ctx?.count).toBe(1)
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    act(() => emitSnapshotError('user-1', new Error('permission-denied')))
    consoleSpy.mockRestore()

    await waitFor(() => {
      const ctx = getFavorites()
      expect(ctx?.count).toBe(0)
    })
  })
})
