'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import { useAuth } from '@/context/AuthContext'

type CartItem = {
  productId: string
  title: string
  price: number
  thumbnail?: string
  qty: number
}

type CartState = {
  items: CartItem[]
}

type Action =
  | { type: 'ADD'; payload: Omit<CartItem, 'qty'>; qty: number }
  | { type: 'INCR'; productId: string }
  | { type: 'DECR'; productId: string }
  | { type: 'REMOVE'; productId: string }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; state: CartState }

const STORAGE_KEY = 'mini-cart-v1'

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'LOAD':
      return action.state

    case 'ADD': {
      const { payload, qty } = action
      const idx = state.items.findIndex(
        (i) => i.productId === payload.productId
      )
      if (idx >= 0) {
        const items = [...state.items]
        items[idx] = { ...items[idx], qty: items[idx].qty + qty }
        return { items }
      }
      return { items: [...state.items, { ...payload, qty }] }
    }

    case 'INCR': {
      const items = state.items.map((i) =>
        i.productId === action.productId ? { ...i, qty: i.qty + 1 } : i
      )
      return { items }
    }

    case 'DECR': {
      const items = state.items
        .map((i) =>
          i.productId === action.productId
            ? { ...i, qty: Math.max(1, i.qty - 1) }
            : i
        )
        .filter((i) => i.qty > 0)
      return { items }
    }

    case 'REMOVE':
      return {
        items: state.items.filter((i) => i.productId !== action.productId),
      }

    case 'CLEAR':
      return { items: [] }

    default:
      return state
  }
}

type CartContextType = {
  state: CartState
  count: number
  total: number
  add: (
    item: Omit<CartItem, 'qty' | 'productId'> & { productId: string | number },
    qty?: number
  ) => Promise<void>
  incr: (productId: string) => void
  decr: (productId: string) => void
  remove: (productId: string) => void
  clear: () => void
  reloadFromStorage: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

function normalizeCartItem(value: unknown): CartItem {
  const obj =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const productId = String(obj.productId ?? obj.id ?? '')
  const title =
    typeof obj.title === 'string' ? obj.title : String(obj.title ?? '')
  const priceValue =
    typeof obj.price === 'number' ? obj.price : Number(obj.price ?? 0)
  const price = Number.isFinite(priceValue) ? Number(priceValue) : 0
  const thumbnail =
    typeof obj.thumbnail === 'string' ? obj.thumbnail : undefined
  const qtyValue = typeof obj.qty === 'number' ? obj.qty : Number(obj.qty ?? 1)
  const qty = Math.max(1, Number.isFinite(qtyValue) ? Math.floor(qtyValue) : 1)

  return { productId, title, price, thumbnail, qty }
}

function parseCartItemsInput(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return []
  return value.map(normalizeCartItem).filter((item) => item.productId)
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] })
  const { user } = useAuth()
  const lastAddRef = useRef<{ id: string; qty: number; ts: number } | null>(
    null
  )

  const loadFromStorage = useCallback(() => {
    try {
      // Prefer current key; fall back to legacy key if present
      const raw =
        localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('mc_cart')
      if (!raw) return

      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return
      const items = (parsed as { items?: unknown }).items
      const normalizedItems = parseCartItemsInput(items)
      dispatch({ type: 'LOAD', state: { items: normalizedItems } })
    } catch {}
  }, [dispatch])

  // Load from LS once
  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  // On login, prefer server cart if exists; otherwise push LS cart to server
  useEffect(() => {
    ;(async () => {
      try {
        if (!user) return
        const token = await user.getIdToken().catch(() => undefined)
        if (!token) return

        // Helper: read LS cart directly
        const readLS = (): CartItem[] => {
          try {
            const raw =
              localStorage.getItem(STORAGE_KEY) ||
              localStorage.getItem('mc_cart')
            if (!raw) return []
            const parsed = JSON.parse(raw) as unknown
            if (!parsed || typeof parsed !== 'object') return []
            const items = (parsed as { items?: unknown }).items
            return parseCartItemsInput(items)
          } catch {
            return []
          }
        }

        // 1) Fetch server cart
        const res = await fetch('/api/user/cart', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = (await res.json()) as unknown
        const serverItems: CartItem[] = (() => {
          if (!data || typeof data !== 'object') return []
          const items = (data as { items?: unknown }).items
          return parseCartItemsInput(items)
        })()

        const localItems = readLS()

        if (serverItems.length > 0) {
          // Prefer server as source of truth
          dispatch({ type: 'LOAD', state: { items: serverItems } })
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ items: serverItems })
            )
          } catch {}
          return
        }

        // Server empty: push local items to server
        for (const it of localItems) {
          await fetch('/api/user/cart/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ productId: it.productId, qty: it.qty }),
          }).catch(() => {})
        }
        dispatch({ type: 'LOAD', state: { items: localItems } })
      } catch {}
    })()
  }, [user])

  // Persist to LS on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!e.key) return
      if (e.key === STORAGE_KEY || e.key === 'mc_cart') {
        loadFromStorage()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [loadFromStorage])

  const count = useMemo(
    () => state.items.reduce((sum, it) => sum + it.qty, 0),
    [state.items]
  )
  const total = useMemo(
    () =>
      state.items.reduce(
        (sum, it) => sum + it.qty * (Number(it.price) || 0),
        0
      ),
    [state.items]
  )

  const add: CartContextType['add'] = async (item, qty = 1) => {
    const productId = String(item.productId)
    const title = String(item.title ?? '')
    const price = Number(item.price)
    const thumbnail = item.thumbnail ? String(item.thumbnail) : undefined
    const safePrice = Number.isFinite(price) ? price : 0
    const safeQty = Math.max(1, Number(qty) || 1)

    // Guard against accidental double-invocation (e.g., rapid double click)
    const now = Date.now()
    const last = lastAddRef.current
    if (
      last &&
      last.id === productId &&
      last.qty === safeQty &&
      now - last.ts < 300
    ) {
      return
    }
    lastAddRef.current = { id: productId, qty: safeQty, ts: now }

    dispatch({
      type: 'ADD',
      payload: { productId, title, price: safePrice, thumbnail },
      qty: safeQty,
    })

    // Server sync if logged in
    try {
      if (user) {
        const token = await user.getIdToken().catch(() => undefined)
        await fetch('/api/user/cart/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            productId,
            qty: safeQty,
            title,
            price: safePrice,
            thumbnail,
          }),
        }).catch(() => {})
      }
    } catch {}
  }
  const incr = (productId: string | number) => {
    const id = String(productId)
    dispatch({ type: 'INCR', productId: id })
    ;(async () => {
      try {
        if (!user) return
        const token = await user.getIdToken().catch(() => undefined)
        const current = state.items.find((i) => i.productId === id)?.qty ?? 0
        const next = current + 1
        await fetch('/api/user/cart/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ productId: id, qty: next }),
        }).catch(() => {})
      } catch {}
    })()
  }
  const decr = (productId: string | number) => {
    const id = String(productId)
    dispatch({ type: 'DECR', productId: id })
    ;(async () => {
      try {
        if (!user) return
        const token = await user.getIdToken().catch(() => undefined)
        const current = state.items.find((i) => i.productId === id)?.qty ?? 1
        const next = Math.max(1, current - 1)
        await fetch('/api/user/cart/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ productId: id, qty: next }),
        }).catch(() => {})
      } catch {}
    })()
  }
  const remove = (productId: string | number) => {
    const id = String(productId)
    dispatch({ type: 'REMOVE', productId: id })
    ;(async () => {
      try {
        if (!user) return
        const token = await user.getIdToken().catch(() => undefined)
        await fetch('/api/user/cart/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ productId: id, qty: 0 }),
        }).catch(() => {})
      } catch {}
    })()
  }
  const clear = () => {
    dispatch({ type: 'CLEAR' })
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    try {
      localStorage.removeItem('mc_cart')
    } catch {}
    ;(async () => {
      try {
        if (!user) return
        const token = await user.getIdToken().catch(() => undefined)
        await fetch('/api/user/cart/clear', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => {})
      } catch {}
    })()
  }

  const value: CartContextType = {
    state,
    count,
    total,
    add,
    incr,
    decr,
    remove,
    clear,
    reloadFromStorage: loadFromStorage,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
