// src/components/ProductDetailClient.tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Product } from '@/types/product'
import { getProductById } from '@/lib/products'

export default function ProductDetailClient({ id }: { id: string }) {
  const [p, setP] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await getProductById(id)
        if (alive) setP(data)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  if (loading) return <p className="text-gray-500">Loading…</p>
  if (!p) return <p className="text-red-600">Product not found.</p>

  const cover = p.images?.[0] || p.thumbnail || '/placeholder.png'

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Görseller */}
      <div className="space-y-3">
        <div className="relative w-full h-80 rounded-xl overflow-hidden bg-slate-100">
          <Image
            src={cover}
            alt={p.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {(p.images || []).slice(0, 4).map((img, i) => (
            <div
              key={i}
              className="relative w-full h-20 rounded-lg overflow-hidden bg-slate-100"
            >
              <Image
                src={img}
                alt={`${p.title} ${i + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bilgi + aksiyonlar */}
      <div>
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <p className="mt-2 text-gray-600">{p.description}</p>
        <p className="mt-4 text-2xl font-bold">${p.price}</p>

        <div className="mt-3 text-sm text-gray-500 space-y-1">
          {p.brand && <p>Brand: {p.brand}</p>}
          <p>Category: {p.category}</p>
          <p>Stock: {p.stock}</p>
          {typeof p.rating === 'number' && <p>Rating: {p.rating} ★</p>}
        </div>

        <button
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-black text-white px-4 py-2 font-medium hover:opacity-90 active:opacity-80"
          onClick={() => {
            // Cart entegrasyonunu bir sonraki adımda gerçek Context ile yapacağız.
            const key = 'cart'
            type CartItem = Pick<
              Product,
              'id' | 'title' | 'price' | 'thumbnail'
            > & { qty: number }
            const prev: CartItem[] = JSON.parse(
              localStorage.getItem(key) || '[]'
            )
            const existing = prev.find((it) => it.id === p.id)
            if (existing) existing.qty += 1
            else
              prev.push({
                id: p.id,
                title: p.title,
                price: p.price,
                thumbnail: p.thumbnail,
                qty: 1,
              })
            localStorage.setItem(key, JSON.stringify(prev))
            alert('Added to cart ✅')
          }}
        >
          Sepete Ekle
        </button>
      </div>
    </div>
  )
}
