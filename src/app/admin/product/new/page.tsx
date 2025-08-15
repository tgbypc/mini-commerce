'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminOnly from '@/components/AdminOnly'
import { createProduct } from '@/lib/products'
import toast from 'react-hot-toast'

const CATEGORY_TREE: Record<string, Record<string, string[]>> = {
  Electronics: {
    Phones: ['Smartphones', 'Feature Phones', 'Accessories'],
    Laptops: ['Ultrabooks', 'Gaming Laptops', 'Accessories'],
    Audio: ['Headphones', 'Speakers', 'Soundbars'],
  },
  Clothing: {
    Women: ['Dresses', 'Tops', 'Jeans'],
    Men: ['T-Shirts', 'Shirts', 'Jeans'],
    Kids: ['Baby', 'Girls', 'Boys'],
  },
  'Home & Kitchen': {
    Appliances: ['Coffee Makers', 'Blenders', 'Microwaves'],
    Cookware: ['Pots', 'Pans', 'Bakeware'],
    Decor: ['Vases', 'Frames', 'Candles'],
  },
  Beauty: {
    Skincare: ['Serums', 'Moisturizers', 'Cleansers'],
    Makeup: ['Lipstick', 'Foundation', 'Mascara'],
    Fragrance: ['Eau de Parfum', 'Eau de Toilette', 'Body Mist'],
  },
}

export default function AdminNewProductPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    id: '',
    title: '',
    price: '',
    thumbnail: '',
    category: '',
    description: '',
    stock: '',
    brand: '',
  })
  const [loading, setLoading] = useState(false)

  const categories = Object.keys(CATEGORY_TREE)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const p = createProduct({
      id: form.id ? Number(form.id) : undefined,
      title: form.title,
      price: form.price,
      thumbnail: form.thumbnail,
      category: form.category,
      description: form.description,
      stock: form.stock,
      brand: form.brand,
    })
    toast.promise(p, {
      loading: 'Kaydediliyor…',
      success: 'Ürün kaydedildi ✅',
      error: (err) => `Hata: ${(err as Error).message}`,
    })
    try {
      const { id } = await p
      router.replace(`/products/${id}`)
    } finally {
      setLoading(false)
    }
  }

  function set<K extends keyof typeof form>(key: K) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const val = e.target.value
      setForm((f) => ({ ...f, [key]: val }))
    }
  }

  return (
    <AdminOnly>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Yeni Ürün Ekle</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-zinc-600">
                ID (opsiyonel, sayı)
              </span>
              <input
                className="mt-1 w-full border rounded p-2"
                value={form.id}
                onChange={set('id')}
                placeholder="1"
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-600">Başlık *</span>
              <input
                required
                className="mt-1 w-full border rounded p-2"
                value={form.title}
                onChange={set('title')}
                placeholder="Akıllı Telefon"
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-600">Fiyat *</span>
              <input
                required
                type="number"
                step="0.01"
                className="mt-1 w-full border rounded p-2"
                value={form.price}
                onChange={set('price')}
                placeholder="199.99"
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-600">Stok</span>
              <input
                type="number"
                className="mt-1 w-full border rounded p-2"
                value={form.stock}
                onChange={set('stock')}
                placeholder="10"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-zinc-600">
                Görsel (thumbnail URL)
              </span>
              <input
                className="mt-1 w-full border rounded p-2"
                value={form.thumbnail}
                onChange={set('thumbnail')}
                placeholder="https://…"
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-600">Kategori</span>
              <select
                className="mt-1 w-full border rounded p-2"
                value={form.category}
                onChange={set('category')}
              >
                <option value="">Seçiniz…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-zinc-600">Marka</span>
              <input
                className="mt-1 w-full border rounded p-2"
                value={form.brand}
                onChange={set('brand')}
                placeholder="Acme"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-zinc-600">Açıklama</span>
              <textarea
                className="mt-1 w-full border rounded p-2"
                rows={4}
                value={form.description}
                onChange={set('description')}
                placeholder="Ürün açıklaması…"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <button
              disabled={loading}
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => history.back()}
              className="px-4 py-2 rounded border"
            >
              Vazgeç
            </button>
          </div>
        </form>
      </div>
    </AdminOnly>
  )
}
