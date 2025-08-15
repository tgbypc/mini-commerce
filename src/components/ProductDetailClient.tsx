// src/components/ProductDetailClient.tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Product } from '@/types/product'
import { getProductById } from '@/lib/products'
import { useCart } from '@/context/CartContext'
import toast from 'react-hot-toast'

export default function ProductDetailClient({ id }: { id: string }) {
  const [p, setP] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const { add } = useCart()

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
        <p className="mt-4 text-2xl font-bold">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(Number(p.price) || 0)}
        </p>

        <div className="mt-3 text-sm text-gray-500 space-y-1">
          {p.brand && <p>Brand: {p.brand}</p>}
          <p>Category: {p.category}</p>
          <p>Stock: {p.stock}</p>
          {typeof p.rating === 'number' && <p>Rating: {p.rating} ★</p>}
        </div>

        <button
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-black text-white px-4 py-2 font-medium hover:opacity-90 active:opacity-80"
          onClick={async () => {
            const promise = add(
              {
                productId: p.id,
                title: p.title,
                price: Number(p.price),
                thumbnail: p.thumbnail,
              },
              1
            )
            toast.promise(promise, {
              loading: 'Sepete ekleniyor…',
              success: 'Ürün sepete eklendi ✅',
              error: 'Sepete eklenemedi',
            })
            await promise
          }}
        >
          Sepete Ekle
        </button>
      </div>
    </div>
  )
}
