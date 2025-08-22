// src/lib/products.ts
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { del } from '@vercel/blob'
import { db } from '@/lib/firebase'
import type { Product } from '@/types/product'
import { AvailabilityStatus } from '@/types/product'

/** Esnek ama 'any' kullanmadan tanım (Firestore'dan gelen belge verisi) */
type UnknownRecord = Record<string, unknown>

/** Sayıya güvenli dönüştürme */
const toNum = (v: unknown, fb = 0): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fb
}

/** Farklı yazımlı/formatlı (TL/USD/nokta-virgül) stringleri sayıya çevirir */
function normalizePrice(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (v == null) return fallback

  // Örn: "$1,299.90" | "1.299,90 TL" | "199,99" | "199.99"
  const s = String(v).trim()
  // Rakam ve ayraçlar dışındaki her şeyi at
  const cleaned = s.replace(/[^\d.,\-]/g, '')
  if (!cleaned) return fallback

  // Hem nokta hem virgül varsa (1.234,56) → binlik noktaları sil, virgülü ondalık yap
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const asDotDecimal = cleaned.replace(/\./g, '').replace(',', '.')
    const n = Number(asDotDecimal)
    return Number.isFinite(n) ? n : fallback
  }

  // Tek ayırıcı varsa: virgülü ondalık kabul et
  const maybe = cleaned.replace(',', '.')
  const n = Number(maybe)
  return Number.isFinite(n) ? n : fallback
}

/** Nested alanları da dene (pricing.price gibi) ve en makul fiyatı seç */
function pickPrice(data: UnknownRecord): number {
  const candidates: unknown[] = [
    data['price'],
    data['cost'],
    data['amount'],
    data['salePrice'],
    (data['pricing'] as UnknownRecord | undefined)?.['price'],
    (data['meta'] as UnknownRecord | undefined)?.['price'],
  ]

  for (const c of candidates) {
    const n = normalizePrice(c)
    if (n !== 0) return n
  }
  // Hiçbiri olmadıysa yine de price'ı zorla deneriz (0 olabilir)
  return normalizePrice(data['price'], 0)
}

export async function getAllProducts(): Promise<Product[]> {
  const snap = await getDocs(collection(db, 'products'))

  return snap.docs.map((d) => {
    const data = (d.data() ?? {}) as UnknownRecord

    const idNum = Number(d.id)
    const idFromData = Number((data['id'] as number | string | undefined))
    const safeId = Number.isFinite(idNum)
      ? idNum
      : Number.isFinite(idFromData)
        ? idFromData
        : NaN

    const p: Product = {
      id: Number.isFinite(safeId) ? (safeId as number) : (data['id'] as number),
      title: (data['title'] as string) ?? '',
      description: (data['description'] as string) ?? '',
      category: (data['category'] as string) ?? '',
      discountPercentage: toNum(data['discountPercentage']),
      rating: toNum(data['rating']),
      stock: toNum(data['stock'], 999), 
      tags: Array.isArray(data['tags']) ? (data['tags'] as string[]) : [],
      brand: (data['brand'] as string) ?? '',
      sku: (data['sku'] as string) ?? '',
      weight: toNum(data['weight']),
      dimensions:
        (data['dimensions'] as Product['dimensions']) ??
        (data['Dimentions'] as Product['dimensions']) ?? { width: 0, height: 0, depth: 0 },
      warrantyInformation: (data['warrantyInformation'] as string) ?? '',
      shippingInformation: (data['shippingInformation'] as string) ?? '',
      availabilityStatus:
        ((data['availability'] as Product['availabilityStatus']) ??
          (data['availabilityStatus'] as Product['availabilityStatus']) ??
          AvailabilityStatus.IN_STOCK),
      reviews: Array.isArray(data['reviews']) ? (data['reviews'] as Product['reviews']) : [],
      meta:
        (data['meta'] as Product['meta']) ?? { createdAt: '', updatedAt: '', barcode: '', qrCode: '' },
      images: Array.isArray(data['images']) ? (data['images'] as string[]) : [],
      thumbnail: (data['thumbnail'] as string) ?? '',
      price: pickPrice(data),
    }

    return p
  })
}

export async function getProductById(id: string): Promise<Product | null> {
  const ref = doc(collection(db, 'products'), id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null

  const data = (snap.data() ?? {}) as UnknownRecord

  const idNum = Number(id)
  const idFromData = Number((data['id'] as number | string | undefined))
  const safeId = Number.isFinite(idNum)
    ? idNum
    : Number.isFinite(idFromData)
      ? idFromData
      : NaN

  const p: Product = {
    id: Number.isFinite(safeId) ? (safeId as number) : (data['id'] as number),
    title: (data['title'] as string) ?? '',
    description: (data['description'] as string) ?? '',
    category: (data['category'] as string) ?? '',
    discountPercentage: toNum(data['discountPercentage']),
    rating: toNum(data['rating']),
    stock: toNum(data['stock']),
    tags: Array.isArray(data['tags']) ? (data['tags'] as string[]) : [],
    brand: (data['brand'] as string) ?? '',
    sku: (data['sku'] as string) ?? '',
    weight: toNum(data['weight']),
    dimensions:
      (data['dimensions'] as Product['dimensions']) ??
      (data['Dimentions'] as Product['dimensions']) ?? { width: 0, height: 0, depth: 0 },
    warrantyInformation: (data['warrantyInformation'] as string) ?? '',
    shippingInformation: (data['shippingInformation'] as string) ?? '',
    availabilityStatus:
      ((data['availability'] as Product['availabilityStatus']) ??
        (data['availabilityStatus'] as Product['availabilityStatus']) ??
        AvailabilityStatus.IN_STOCK),
    reviews: Array.isArray(data['reviews']) ? (data['reviews'] as Product['reviews']) : [],
    meta:
      (data['meta'] as Product['meta']) ?? { createdAt: '', updatedAt: '', barcode: '', qrCode: '' },
    images: Array.isArray(data['images']) ? (data['images'] as string[]) : [],
    thumbnail: (data['thumbnail'] as string) ?? '',
    price: pickPrice(data),
  }

  return p
}

// ----- Admin: Create Product -----
export type NewProductInput = {
  id?: number
  title: string
  description?: string
  category?: string
  price: number | string
  thumbnail?: string
  images?: string[]
  stock?: number | string
  brand?: string
  tags?: string[]
}

export async function createProduct(input: NewProductInput): Promise<{ id: string | number }> {
  const price = typeof input.price === 'number' ? input.price : Number(input.price)
  const stock = typeof input.stock === 'number' ? input.stock : Number(input.stock ?? 0)
  const nowISO = new Date().toISOString()

  const base: Partial<Product> = {
    title: input.title,
    description: input.description ?? '',
    category: input.category ?? '',
    price: Number.isFinite(price) ? price : 0,
    thumbnail: input.thumbnail ?? '',
    images: Array.isArray(input.images) ? input.images : [],
    stock: Number.isFinite(stock) ? stock : 0,
    brand: input.brand ?? '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    availabilityStatus: AvailabilityStatus.IN_STOCK,
    reviews: [],
    meta: { createdAt: nowISO, updatedAt: nowISO, barcode: '', qrCode: '' },
  }

  // Always use a numeric id for doc id to match Product.id:number
  const numericId = (typeof input.id === 'number' && Number.isFinite(input.id))
    ? input.id
    : Date.now() // simple numeric id; unique enough for this app

  const ref = doc(collection(db, 'products'), String(numericId))
  await setDoc(ref, { ...base, id: numericId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return { id: numericId }
}

/** Vercel Blob URL kontrolü */
function isBlobUrl(url: unknown): url is string {
  return typeof url === 'string' && /\bblob\.vercel-storage\.com\b/.test(url)
}

/** Ürünü ve varsa Vercel Blob görsellerini siler */
export async function deleteProductAndBlobs(id: string): Promise<{ ok: true }> {
  const ref = doc(collection(db, 'products'), id)
  const snap = await getDoc(ref)

  // Silinecek blob URL’lerini topla
  const urls: string[] = []
  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>
    const image = data['image']
    const thumbnail = data['thumbnail']
    const images = data['images']

    if (isBlobUrl(image)) urls.push(image)
    if (isBlobUrl(thumbnail)) urls.push(thumbnail)
    if (Array.isArray(images)) {
      for (const u of images) if (isBlobUrl(u)) urls.push(u)
    }
  }

  // Blob'ları sil (birinde hata olsa bile devam)
  for (const url of urls) {
    try {
      await del(url)
    } catch {
      // yut – ürün silme engellenmesin
    }
  }

  // En sonda Firestore dokümanını sil
  await deleteDoc(ref)
  return { ok: true }
}