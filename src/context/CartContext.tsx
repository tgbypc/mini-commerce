'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react'

type CartItem = {
  productId: string | number
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
  | { type: 'INCR'; productId: string | number }
  | { type: 'DECR'; productId: string | number }
  | { type: 'REMOVE'; productId: string | number }
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
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => Promise<void>
  incr: (productId: string | number) => void
  decr: (productId: string | number) => void
  remove: (productId: string | number) => void
  clear: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] })

  // Load from LS once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CartState
        if (parsed?.items && Array.isArray(parsed.items)) {
          dispatch({ type: 'LOAD', state: parsed })
        }
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
    const price = Number(item.price) || 0
    dispatch({ type: 'ADD', payload: { ...item, price }, qty })
  }
  const incr = (productId: string | number) =>
    dispatch({ type: 'INCR', productId })
  const decr = (productId: string | number) =>
    dispatch({ type: 'DECR', productId })
  const remove = (productId: string | number) =>
    dispatch({ type: 'REMOVE', productId })
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
