'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './AuthContext'

type FavoriteItem = {
  productId: string
  title?: string
  thumbnail?: string
  price?: number
  addedAt?: unknown
}

type FavoritesContextType = {
  items: FavoriteItem[]
  ids: Set<string>
  count: number
  isFavorite: (productId: string | number) => boolean
  add: (item: {
    productId: string | number
    title?: string
    thumbnail?: string
    price?: number
  }) => Promise<void>
  remove: (productId: string | number) => Promise<void>
  toggle: (item: {
    productId: string | number
    title?: string
    thumbnail?: string
    price?: number
  }) => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(
  undefined
)

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<FavoriteItem[]>([])

  useEffect(() => {
    if (!user) {
      setItems([])
      return
    }
    const ref = collection(db, 'users', user.uid, 'favorites')
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const rows: FavoriteItem[] = snap.docs.map((d) => {
          const raw = d.data() as Partial<FavoriteItem>
          return {
            productId: d.id,
            title: raw.title,
            thumbnail: raw.thumbnail,
            price: typeof raw.price === 'number' ? raw.price : undefined,
            addedAt: raw.addedAt,
          }
        })
        setItems(rows)
      },
      (err) => {
        // Gracefully handle permission-denied and other errors in dev/prod
        console.error('[favorites] snapshot error:', err)
        setItems([])
      }
    )
    return () => unsub()
  }, [user])

  const ids = useMemo(
    () => new Set(items.map((i) => String(i.productId))),
    [items]
  )
  const count = items.length
  const isFavorite = (pid: string | number) => ids.has(String(pid))

  async function add(item: {
    productId: string | number
    title?: string
    thumbnail?: string
    price?: number
  }) {
    if (!user) return
    const id = String(item.productId)
    const ref = doc(db, 'users', user.uid, 'favorites', id)
    await setDoc(
      ref,
      {
        productId: id,
        title: item.title ?? null,
        thumbnail: item.thumbnail ?? null,
        price: typeof item.price === 'number' ? item.price : null,
        addedAt: serverTimestamp(),
      },
      { merge: true }
    )
  }

  async function remove(productId: string | number) {
    if (!user) return
    const id = String(productId)
    const ref = doc(db, 'users', user.uid, 'favorites', id)
    await deleteDoc(ref)
  }

  async function toggle(item: {
    productId: string | number
    title?: string
    thumbnail?: string
    price?: number
  }) {
    if (isFavorite(item.productId)) {
      await remove(item.productId)
    } else {
      await add(item)
    }
  }

  const value: FavoritesContextType = {
    items,
    ids,
    count,
    isFavorite,
    add,
    remove,
    toggle,
  }
  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx)
    throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
