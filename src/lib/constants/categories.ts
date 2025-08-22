// src/lib/constants/categories.ts
export const CATEGORIES = [
  'cosmetics',
  'skincare',
  'hair',
  'makeup',
  'fragrance',
  'body',
  'electronics',
  'clothing',
  'home-kitchen',
  'games',
  'books',
] as const

export type Category = (typeof CATEGORIES)[number]

// (Opsiyonel) UI'de Türkçe göstermek istersen:
export const CATEGORY_LABELS: Record<Category, string> = {
  cosmetics: 'Kozmetik',
  skincare: 'Cilt Bakımı',
  hair: 'Saç',
  makeup: 'Makyaj',
  fragrance: 'Parfüm',
  body: 'Vücut',
  electronics: 'Elektronik',
  clothing: 'Giyim',
  'home-kitchen': 'Ev & Mutfak',
  games: 'Oyun',
  books: 'Kitap',
}