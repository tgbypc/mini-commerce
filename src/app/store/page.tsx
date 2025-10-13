import Script from 'next/script'
import type { Metadata } from 'next'
import StoreClient from '@/components/store/StoreClient'
import { getBaseUrl, getInternalFetchHeaders } from '@/lib/runtimeEnv'

const DEFAULT_LOCALE = 'en'
export const revalidate = 300

const title = 'Shop curated essentials | MiniCommerce Store'
const description =
  'Browse design-led electronics, home goods and wardrobe staples. Fast delivery, generous returns and tailored support across every order.'

type ProductPreview = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  price: number
  thumbnail?: string | null
}

type ProductsResponse = {
  items?: ProductPreview[]
}

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    url: 'https://minicommerce.example/store',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
}

async function fetchFeaturedProducts(): Promise<ProductPreview[]> {
  try {
    const baseUrl = getBaseUrl()
    const internalHeaders = getInternalFetchHeaders()
    const res = await fetch(
      `${baseUrl}/api/products?limit=8&sort=createdAt-desc&locale=${DEFAULT_LOCALE}`,
      {
        next: { revalidate, tags: ['products'] },
        headers: internalHeaders,
      }
    )
    if (!res.ok) throw new Error(`status_${res.status}`)
    const payload = (await res.json()) as ProductsResponse
    return Array.isArray(payload.items) ? payload.items : []
  } catch (error) {
    console.error('[store] failed to fetch featured products', error)
    return []
  }
}

export default async function StorePage() {
  const products = await fetchFeaturedProducts()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: title,
    description,
    url: 'https://minicommerce.example/store',
    department: 'Online retail',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://minicommerce.example/store?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <Script id="ld-store" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>
      <StoreClient initialProducts={products} initialLocale={DEFAULT_LOCALE} />
    </>
  )
}
