// src/components/ProductDetailClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/types/product'
import { getProductById } from '@/lib/products'
import { useCart } from '@/context/CartContext'
import { toast } from 'react-hot-toast'

function money(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(n || 0)
  } catch {
    return `$${(n || 0).toFixed(2)}`
  }
}

type Row = { label: string; value?: string }

export default function ProductDetailClient({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [broken, setBroken] = useState(false)
  const { add } = useCart()

  useEffect(() => {
    const sid = String(id ?? '').trim()
    if (!sid) {
      setProduct(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    getProductById(sid).then((p) => {
      if (alive) {
        setProduct(p)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [id])

  const rows = useMemo<Row[]>(() => {
    const p = product
    return [
      { label: 'Brand', value: p?.brand },
      { label: 'Category', value: p?.category },
      {
        label: 'Stock',
        value: typeof p?.stock === 'number' ? String(p.stock) : undefined,
      },
      { label: 'SKU', value: p?.sku },
      { label: 'Warranty', value: p?.warrantyInformation },
      { label: 'Shipping', value: p?.shippingInformation },
    ]
  }, [product])

  const handleAdd = () => {
    if (!product) return
    add(
      {
        productId: String(product.id),
        title: product.title,
        price: Number(product.price) || 0,
        thumbnail: product.thumbnail,
      },
      1
    )
    toast.success(`${product.title} added to cart!`)
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 md:px-0 py-6 animate-pulse">
        <div className="h-[28px] w-40 bg-slate-200 rounded mb-4" />
        <div className="relative w-full aspect-[4/5] bg-slate-200 rounded-xl" />
        <div className="h-6 bg-slate-200 rounded w-2/3 mt-6" />
        <div className="h-4 bg-slate-200 rounded w-full mt-3" />
        <div className="h-4 bg-slate-200 rounded w-5/6 mt-2" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 md:px-0 py-10 text-center">
        <p className="text-lg">Product not found.</p>
        <Link href="/" className="text-indigo-600 underline">
          Go back
        </Link>
      </div>
    )
  }

  const price = money(Number(product.price) || 0)
  const imgSrc = broken
    ? '/placeholder.png'
    : product.thumbnail || '/placeholder.png'

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 md:px-0 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 mb-3">
        <Link href="/" className="hover:underline">
          Shop
        </Link>
        <span className="mx-1">/</span>
        <span className="capitalize">{product.category || 'General'}</span>
      </nav>

      {/* Big image */}
      <div className="relative w-full md:max-w-[640px] mx-auto aspect-[3/4] rounded-xl overflow-hidden bg-slate-100">
        <Image
          src={imgSrc}
          alt={product.title}
          fill
          sizes="(max-width: 768px) 50vw, 640px"
          className="object-cover"
          onError={() => setBroken(true)}
          priority
        />
      </div>

      {/* Text & specs */}
      <div className="mt-6">
        <h1 className="text-xl md:text-2xl font-semibold text-[#0d141c]">
          {product.title}
        </h1>
        {product.description && (
          <p className="mt-2 text-slate-600 leading-relaxed max-w-prose">
            {product.description}
          </p>
        )}

        <h2 className="mt-6 text-sm font-semibold text-slate-600">
          Key Features
        </h2>
        <div className="mt-2 rounded-xl border border-slate-200">
          <dl className="divide-y divide-slate-200">
            {rows.map((r) => (
              <div
                key={r.label}
                className="grid grid-cols-3 md:grid-cols-6 px-4 py-3"
              >
                <dt className="col-span-1 text-xs md:text-sm text-slate-500">
                  {r.label}
                </dt>
                <dd className="col-span-2 md:col-span-5 text-xs md:text-sm text-slate-800">
                  {r.value || '-'}
                </dd>
              </div>
            ))}
            <div className="grid grid-cols-3 md:grid-cols-6 px-4 py-3">
              <dt className="col-span-1 text-xs md:text-sm text-slate-500">
                Price
              </dt>
              <dd className="col-span-2 md:col-span-5 text-xs md:text-sm text-slate-800">
                {price}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleAdd}
            disabled={
              typeof product.stock === 'number' ? product.stock <= 0 : false
            }
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0d141c] px-5 text-white font-semibold hover:opacity-90 transition-transform duration-150 hover:scale-105 active:scale-95 active:bg-[#1a202c] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Add to cart"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}
