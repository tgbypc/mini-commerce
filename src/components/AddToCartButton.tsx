'use client'

import { useCallback } from 'react'
import { useCart } from '@/context/CartContext'

type MinimalProduct = {
  id: string | number
  title: string
  price: number | string
  thumbnail?: string
  stock?: number
}

export default function AddToCartButton({
  product,
  qty = 1,
}: {
  product: MinimalProduct
  qty?: number
}) {
  const { add } = useCart()

  const onAdd = useCallback(async () => {
    const productId = String(product.id)
    const title = String(product.title ?? '')
    const price = Number(product.price) || 0

    // İstersen stok koruması
    if (typeof product.stock === 'number' && product.stock <= 0) {
      return
    }

    await add({ productId, title, price, thumbnail: product.thumbnail }, qty)
    // burada istersen toast da atabilirsin
  }, [add, product, qty])

  return (
    <button
      type="button"
      onClick={onAdd}
      className="rounded-lg bg-black px-3 py-2 text-white text-sm"
    >
      Add to cart
    </button>
  )
}
