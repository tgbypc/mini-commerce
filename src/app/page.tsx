import Script from 'next/script'
import type { Metadata } from 'next'
import HomeClient from '@/components/home/HomeClient'

const DEFAULT_LOCALE = 'en'
export const revalidate = 120

const pageTitle = 'MiniCommerce | Modern essentials for everyday living'
const pageDescription =
  'Discover curated beauty, home and lifestyle products from independent makers and global icons. Fast delivery, easy returns and concierge-level support.'

type ListItem = {
  id: string
  title: string
  description?: string
  category?: string
  brand?: string
  price: number
  thumbnail?: string
}

type ProductsResponse = {
  items?: ListItem[]
  nextCursor?: string | null
}

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    type: 'website',
    url: 'https://minicommerce.example',
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
  },
}

function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl?.length) {
    return envUrl.startsWith('http') ? envUrl : `https://${envUrl}`
  }

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl?.length) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`
  }

  return 'http://localhost:3000'
}

async function fetchInitialProducts(): Promise<{ items: ListItem[]; nextCursor: string | null }> {
  try {
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/api/products?limit=20&sort=createdAt-desc&locale=${DEFAULT_LOCALE}`, {
      next: { revalidate, tags: ['products'] },
    })
    if (!res.ok) throw new Error(`status_${res.status}`)
    const payload = (await res.json()) as ProductsResponse
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      nextCursor: payload.nextCursor ?? null,
    }
  } catch (error) {
    console.error('[home] failed to fetch initial products', error)
    return { items: [], nextCursor: null }
  }
}

export default async function HomePage() {
  const { items, nextCursor } = await fetchInitialProducts()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: pageTitle,
    description: pageDescription,
    url: 'https://minicommerce.example/',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://minicommerce.example/?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <Script id="ld-home" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>
      <HomeClient initialItems={items} initialNextCursor={nextCursor} initialLocale={DEFAULT_LOCALE} />
    </>
  )
}
