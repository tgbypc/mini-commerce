'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react'

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
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] })

  // Load from LS once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return

      const parsed: unknown = JSON.parse(raw)
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { items?: unknown }).items)
      ) {
        const arr = (parsed as { items: unknown[] }).items
        const normalizedItems: CartItem[] = arr.map((i): CartItem => {
          const obj = (i ?? {}) as Record<string, unknown>
          const productId = String(obj.productId ?? '')
          const title =
            typeof obj.title === 'string' ? obj.title : String(obj.title ?? '')
          const priceValue =
            typeof obj.price === 'number'
              ? obj.price
              : Number(obj.price as unknown)
          const price = Number.isFinite(priceValue) ? priceValue : 0
          const thumbnail =
            typeof obj.thumbnail === 'string' ? obj.thumbnail : undefined
          const qtyValue =
            typeof obj.qty === 'number' ? obj.qty : Number(obj.qty as unknown)
          const qty = Math.max(
            1,
            Number.isFinite(qtyValue) ? Math.floor(qtyValue) : 1
          )

          return { productId, title, price, thumbnail, qty }
        })

        dispatch({ type: 'LOAD', state: { items: normalizedItems } })
      }
    } catch {}
  }, [])

  // Persist to LS on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])

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

    dispatch({
      type: 'ADD',
      payload: { productId, title, price: safePrice, thumbnail },
      qty: safeQty,
    })
  }
  const incr = (productId: string | number) =>
    dispatch({ type: 'INCR', productId: String(productId) })
  const decr = (productId: string | number) =>
    dispatch({ type: 'DECR', productId: String(productId) })
  const remove = (productId: string | number) =>
    dispatch({ type: 'REMOVE', productId: String(productId) })
  const clear = () => dispatch({ type: 'CLEAR' })

  const value: CartContextType = {
    state,
    count,
    total,
    add,
    incr,
    decr,
    remove,
    clear,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
