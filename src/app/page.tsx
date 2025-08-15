'use client'

import { useEffect, useState } from 'react'
import { getAllProducts } from '@/lib/products'
import Image from 'next/image'
import Link from 'next/link'
import { Product } from '@/types/product'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    getAllProducts().then(setProducts)
  }, [])

  return (
    <div>
      {/* HERO / BANNER */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center">
          {/* Sol Metin */}
          <div className="flex-1 mb-8 md:mb-0">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Yeni Sezon <span className="text-indigo-600">İndirimleri</span>
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Don’t miss out on up to 50% off the most popular products.
              Discover now and grab the deals!
            </p>
            <Link
              href="#products"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
            >
              Alışverişe Başla
            </Link>
          </div>

          {/* Sağ Görsel */}
          <div className="flex-1">
            <Image
              src="https://images.unsplash.com/photo-1512496015851-a90fb38ba796"
              alt="Hero Banner"
              width={600}
              height={400}
              className="rounded-lg shadow-lg object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* ÜRÜNLER */}
      <section id="products" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold mb-6">Popüler Ürünler</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="block border rounded-lg p-4 hover:shadow-lg transition"
            >
              <Image
                src={p.thumbnail}
                alt={p.title}
                width={300}
                height={200}
                className="w-full h-48 object-cover rounded"
              />
              <h3 className="mt-4 font-medium">{p.title}</h3>
              <p className="text-indigo-600 font-semibold">
                {currency.format(Number(p.price) || 0)}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
