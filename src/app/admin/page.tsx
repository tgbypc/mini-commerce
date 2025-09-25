'use client'

import Link from 'next/link'

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-sm text-zinc-600">Quick actions for your store.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/product/new"
          className="rounded-xl border p-4 hover:bg-zinc-50"
        >
          <div className="font-medium">Add Product</div>
          <div className="text-sm text-zinc-600">Create a new product</div>
        </Link>

        <Link
          href="/admin/product"
          className="rounded-xl border p-4 hover:bg-zinc-50"
        >
          <div className="font-medium">Manage Products</div>
          <div className="text-sm text-zinc-600">Edit or remove products</div>
        </Link>

        <Link
          href="/admin/orders"
          className="rounded-xl border p-4 hover:bg-zinc-50"
        >
          <div className="font-medium">Manage Orders</div>
          <div className="text-sm text-zinc-600">View customer orders</div>
        </Link>

        {/* İleride Users / Reports gibi kutular eklenebilir */}
      </div>
    </div>
  )
}
