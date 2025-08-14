// src/app/products/[id]/page.tsx
import { use } from 'react'
import ProductDetailClient from '@/components/ProductDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default function ProductDetailPage(props: Props) {
  const { id } = use(props.params) // Next.js 15: params bir Promise

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ProductDetailClient id={id} />
    </div>
  )
}
