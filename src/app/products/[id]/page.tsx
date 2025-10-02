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
    <div className="bg-[#f6f7fb]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-10 lg:px-16">
        <ProductDetailClient id={sid} />
      </div>
    </div>
  )
}
