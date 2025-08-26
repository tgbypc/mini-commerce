import { Suspense } from 'react'
import SuccessClient from './SuccessClient' // ← normal import, dynamic yok

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto p-6">
          <div className="h-6 w-40 bg-slate-200 rounded mb-3 animate-pulse" />
          <div className="h-4 w-64 bg-slate-200 rounded mb-2 animate-pulse" />
          <div className="h-32 w-full bg-slate-100 rounded animate-pulse" />
        </div>
      }
    >
      <SuccessClient />
    </Suspense>
  )
}
