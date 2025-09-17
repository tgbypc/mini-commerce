'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useFavorites } from '@/context/FavoritesContext'
import { useAuth } from '@/context/AuthContext'
import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type ProductDoc = {
  id?: string
  title?: string
  price?: number
  thumbnail?: string
}

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth()
  const { items } = useFavorites()
  const [enriched, setEnriched] = useState<Array<ProductDoc & { productId: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (authLoading) return
      if (!user) {
        setEnriched([])
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const rows: Array<ProductDoc & { productId: string }> = []
        for (const it of items) {
          const pid = String(it.productId)
          let title = it.title
          let thumbnail = it.thumbnail
          let price = it.price
          if (!title || !thumbnail || typeof price !== 'number') {
            try {
              const snap = await getDoc(doc(db, 'products', pid))
              if (snap.exists()) {
                const d = snap.data() as ProductDoc
                title = title ?? d.title
                thumbnail = thumbnail ?? d.thumbnail
                price = typeof price === 'number' ? price : d.price
              }
            } catch {}
          }
          rows.push({ productId: pid, id: pid, title, thumbnail, price })
        }
        if (!cancelled) setEnriched(rows)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [user, authLoading, items])

  if (!user && !authLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Favorilerim</h1>
        <p className="mt-2 text-zinc-600">Favorilerinizi görmek için lütfen giriş yapın.</p>
        <Link href="/user/login" className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">Giriş Yap</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="h-6 w-48 bg-gray-200 rounded mb-3 animate-pulse" />
        <div className="h-4 w-72 bg-gray-100 rounded mb-4 animate-pulse" />
        <div className="h-24 w-full bg-gray-50 rounded animate-pulse" />
      </div>
    )
  }

  if (!enriched.length) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Favorilerim</h1>
        <div className="mt-3 rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-zinc-600">Henüz favori ürününüz yok.</p>
          <div className="pt-3">
            <Link href="/" className="inline-flex rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50">Alışverişe Devam Et</Link>
          </div>
        </div>
      </div>
    )
  }

  const currency = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Favorilerim</h1>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {enriched.map((p) => (
          <Link key={p.productId} href={`/products/${p.productId}`} className="rounded-xl border bg-white p-3 shadow-sm hover:shadow-md transition">
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
              <Image src={(p.thumbnail ?? '').trim() || '/placeholder.png'} alt={p.title || 'Ürün'} fill className="object-cover" />
            </div>
            <div className="mt-2 text-sm font-medium">{p.title || 'Ürün'}</div>
            <div className="text-sm text-zinc-700">{currency.format(Number(p.price) || 0)}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

