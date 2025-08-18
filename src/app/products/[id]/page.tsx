import { use } from 'react'
import { notFound } from 'next/navigation'
import ProductDetailClient from '@/components/ProductDetailClient'

interface Props {
  params: Promise<{ id?: string }>
}

export const dynamic = 'force-dynamic'

export default function ProductDetailPage({ params }: Props) {
  const p = use(params)
  const sid = String(p?.id ?? '').trim()
  if (!sid) {
    notFound()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ProductDetailClient id={sid} />
    </div>
  )
}
