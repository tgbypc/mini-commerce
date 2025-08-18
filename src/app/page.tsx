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

  const [activeCat, setActiveCat] = useState<string>('Tüm Ürünler')
  const categories = [
    'Tüm Ürünler',
    'Elektronik',
    'Giyim',
    'Ev & Mutfak',
    'Kitaplar',
  ]
  const catMap: Record<string, string> = {
    Elektronik: 'electronics',
    Giyim: 'clothing',
    'Ev & Mutfak': 'home & kitchen',
    Kitaplar: 'books',
  }
  const norm = (s?: string) => (s || '').toLowerCase().trim()
  const visible =
    activeCat === 'Tüm Ürünler'
      ? products
      : products.filter((p) => norm(p.category) === norm(catMap[activeCat]))

  useEffect(() => {
    getAllProducts().then(setProducts)
  }, [])

  return (
    <div className="px-4 md:px-40 py-5">
      <div className="mx-auto w-full max-w-[960px]">
        {/* Arama + Kategori pill'leri */}
        <div className="px-0 md:px-4 py-3">
          <label className="flex h-12 w-full">
            <div className="flex w-full items-stretch rounded-xl overflow-hidden">
              <div className="text-[#49739c] flex items-center justify-center pl-4 bg-[#e7edf4]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                >
                  <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                </svg>
              </div>
              <input
                placeholder="Ürünleri ara"
                className="form-input flex-1 border-none bg-[#e7edf4] outline-none px-4 text-base rounded-r-xl placeholder:text-[#49739c]"
              />
            </div>
          </label>
        </div>

        <div className="flex gap-3 p-3 flex-wrap">
          {categories.map((c) => {
            const active = c === activeCat
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveCat(c)}
                className={
                  `h-8 items-center justify-center rounded-xl px-4 text-sm font-medium transition ` +
                  (active
                    ? 'bg-[#dfe7f1] text-[#0d141c] ring-1 ring-[#cedbe8]'
                    : 'bg-[#e7edf4] text-[#0d141c] hover:bg-[#dfe7f1]')
                }
              >
                {c}
              </button>
            )
          })}
        </div>

        {/* Öne Çıkan Ürünler */}
        <h3 className="text-[#0d141c] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">
          Öne Çıkan Ürünler
        </h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 p-4">
          {visible.slice(0, 4).map((p: Product) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="flex flex-col gap-3 pb-3 transition hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#cedbe8] rounded-xl"
            >
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100">
                <Image
                  src={(p.thumbnail ?? '').trim() || '/placeholder.png'}
                  alt={p.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                />
              </div>
              <div className="px-2">
                <p className="text-[#0d141c] text-base font-medium leading-normal">
                  {p.title}
                </p>
                <p className="text-[#49739c] text-sm leading-normal line-clamp-2">
                  {(p.description || '').slice(0, 64)}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Tüm Ürünler */}
        <h3 className="text-[#0d141c] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">
          Tüm Ürünler
        </h3>
        <div className="flex max-w-[480px] items-end gap-4 px-4 py-3">
          <label className="flex flex-col min-w-40 flex-1">
            <select className="h-14 rounded-xl border border-[#cedbe8] bg-slate-50 px-4">
              <option value="">Sırala</option>
              <option value="price-asc">Fiyat (Artan)</option>
              <option value="price-desc">Fiyat (Azalan)</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 p-4">
          {visible.map((p: Product) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="flex flex-col gap-3 pb-3 transition hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#cedbe8] rounded-xl"
            >
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100">
                <Image
                  src={(p.thumbnail ?? '').trim() || '/placeholder.png'}
                  alt={p.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                />
              </div>
              <div className="px-2">
                <p className="text-[#0d141c] text-base font-medium leading-normal">
                  {p.title}
                </p>
                <p className="text-[15px] font-semibold text-[#0d141c]">
                  {currency.format(Number(p.price) || 0)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
