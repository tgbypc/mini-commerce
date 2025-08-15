'use client'

import Link from 'next/link'

export default function AdminProducts() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Products</h2>
        <Link
          href="/admin/product/new"
          className="rounded-lg bg-black px-3 py-2 text-sm text-white"
        >
          + Add
        </Link>
      </div>

      <div className="rounded-xl border p-4 text-sm text-zinc-600">
        Product list will be here…
      </div>
    </div>
  )
}
