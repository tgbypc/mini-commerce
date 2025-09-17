'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import AdminOnly from '@/components/AdminOnly'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user } = useAuth()

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        className={
          'block rounded-lg px-3 py-2 text-sm ' +
          (active ? 'bg-black text-white' : 'hover:bg-zinc-100')
        }
      >
        {label}
      </Link>
    )
  }

  return (
    <AdminOnly>
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="border-r bg-white p-4 space-y-4">
          <div className="px-2">
            <Link href="/" className="font-bold tracking-tight">
              MiniCommerce
            </Link>
            <div className="text-xs text-zinc-500 mt-1">Admin Panel</div>
          </div>

          <nav className="space-y-1">
            <NavLink href="/admin" label="Dashboard" />
            <NavLink href="/admin/product" label="Products" />
            <NavLink href="/admin/orders" label="Orders" />
            <NavLink href="/admin/product/new" label="Add Product" />
            {/* ileride: Orders, Users, Settings */}
          </nav>

          <div className="mt-6 border-t pt-4 text-xs text-zinc-500">
            {user?.email}
          </div>

          <button
            type="button"
            disabled={!user}
            onClick={() => (user ? signOut(auth) : undefined)}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {user ? 'Sign out' : 'Not signed in'}
          </button>
        </aside>

        {/* Content */}
        <div className="min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
            <h1 className="text-lg font-semibold">Admin</h1>
            <div className="text-sm text-zinc-600">{user?.email ?? '—'}</div>
          </header>

          <main className="p-5">{children}</main>
        </div>
      </div>
    </AdminOnly>
  )
}
