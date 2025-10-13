'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  PackageSearch,
  ShoppingBag,
  X,
} from 'lucide-react'
import { signOut } from 'firebase/auth'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'
import AdminOnly from '@/components/AdminOnly'
import ThemeToggle from '@/components/ThemeToggle'

type NavItem = {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/admin',
    label: 'Overview',
    description: 'Store health & quick stats',
    icon: LayoutDashboard,
  },
  {
    href: '/admin/product',
    label: 'Products',
    description: 'Catalog management & translations',
    icon: PackageSearch,
  },
  {
    href: '/admin/product/new',
    label: 'Add Product',
    description: 'Create a new listing',
    icon: PackagePlus,
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    description: 'Payments, status & logistics',
    icon: ShoppingBag,
  },
]

function SidebarLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group block rounded-2xl px-4 py-3 transition ${
        active
          ? 'admin-card border border-blue-500/35 text-[var(--foreground)] shadow-[0_20px_40px_-28px_rgba(37,99,235,0.45)]'
          : 'admin-card-soft text-[rgb(var(--admin-muted-rgb))] hover:border-blue-400/35 hover:bg-blue-500/12 hover:text-[var(--foreground)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-9 items-center justify-center rounded-xl border ${
            active
              ? 'border-blue-500/40 bg-blue-500/15 text-blue-700'
              : 'border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.9)] text-blue-600 group-hover:border-blue-400/35 group-hover:text-blue-700'
          }`}
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">{item.label}</p>
          <p
            className={`text-xs transition ${
              active
                ? 'text-[rgb(var(--admin-muted-rgb))]'
                : 'text-[rgb(var(--admin-muted-rgb))] group-hover:text-[var(--foreground)]'
            }`}
          >
            {item.description}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeItem = useMemo(() => {
    return (
      NAV_ITEMS.find(
        (item) =>
          pathname === item.href || pathname?.startsWith(`${item.href}/`)
      ) ?? NAV_ITEMS[0]
    )
  }, [pathname])

  const handleSignOut = async () => {
    if (!user) return
    await signOut(auth)
  }

  return (
    <AdminOnly>
      <div
        data-admin-shell
        className="admin-shell relative flex min-h-screen transition-colors"
      >
        {/* Sidebar (desktop) */}
        <aside className="admin-sidebar hidden w-72 shrink-0 flex-col px-6 py-8 text-[rgb(var(--admin-muted-rgb))] lg:flex">
          <div className="admin-sidebar-section">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-3xl border border-blue-500/35 bg-blue-500/15 text-blue-600 shadow-[0_20px_48px_-30px_rgba(37,99,235,0.55)]">
                <LayoutDashboard className="size-5" strokeWidth={1.75} />
              </span>
              <span>
                <span className="text-xs font-semibold uppercase tracking-[0.32em] text-[rgb(var(--admin-muted-rgb))]">
                  MiniCommerce
                </span>
                <p className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                  Admin Control
                </p>
              </span>
            </Link>

            <nav className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={
                    pathname === item.href ||
                    pathname?.startsWith(`${item.href}/`)
                  }
                />
              ))}
            </nav>
          </div>

          <div className="mt-auto rounded-2xl admin-card-soft space-y-3 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-[rgb(var(--foreground-muted-rgb))]">
              Account
            </div>
            <div className="space-y-1">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">
                {user?.displayName || user?.email || 'Admin'}
              </p>
              <p className="text-xs text-[rgb(var(--foreground-muted-rgb))]">
                Full access • Secure session
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-600 transition hover:border-blue-400/40 hover:bg-blue-500/20"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </aside>

        {/* Sidebar (mobile) */}
        <div
          className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[calc(100vw-32px)] px-5 py-6 transition duration-300 lg:hidden ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="admin-sidebar flex h-full flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/"
                className="text-base font-semibold tracking-tight text-[var(--foreground)]"
              >
                MiniCommerce Admin
              </Link>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.9)] p-2 text-[var(--foreground)] transition hover:border-blue-400/40 hover:bg-blue-500/10"
                aria-label="Close menu"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <nav className="mt-6 flex-1 space-y-2 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={
                    pathname === item.href ||
                    pathname?.startsWith(`${item.href}/`)
                  }
                  onNavigate={() => setSidebarOpen(false)}
                />
              ))}
            </nav>
            <div className="mt-4 flex items-center justify-between rounded-2xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-3 py-2 text-xs uppercase tracking-[0.24em] text-[rgb(var(--admin-muted-rgb))]">
              <span>Theme</span>
              <ThemeToggle />
            </div>
            <Link
              href="/"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/15 px-3 py-2 text-sm font-semibold text-blue-600 transition hover:border-blue-400/60 hover:bg-blue-500/25"
              onClick={() => setSidebarOpen(false)}
            >
              View site
              <ArrowUpRight className="size-4" strokeWidth={1.75} />
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-600 transition hover:border-blue-400/40 hover:bg-blue-500/20"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </div>
        {sidebarOpen && (
          <div
            role="presentation"
            className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.4)] backdrop-blur lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex w-full flex-1 flex-col">
          <header className="sticky top-0 z-30 px-4 py-4 transition-colors sm:px-6 lg:px-10">
            <div className="admin-appbar mx-auto w-full max-w-6xl">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] p-2 text-[var(--foreground)] transition hover:border-blue-400/40 hover:bg-blue-500/12 lg:hidden"
                >
                  <Menu className="size-5" strokeWidth={1.75} />
                  <span className="sr-only">Toggle navigation</span>
                </button>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-blue-500/70">
                    Admin Panel
                  </p>
                  <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
                    {activeItem.label}
                  </h1>
                </div>
              </div>
              <div className="hidden items-center gap-3 sm:flex">
                <ThemeToggle />
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-600 transition hover:border-blue-400/45 hover:bg-blue-500/18"
                >
                  View site
                  <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
                </Link>
                <div className="flex items-center gap-3 rounded-2xl border admin-border bg-[rgba(var(--admin-surface-soft-rgb),0.92)] px-4 py-2 text-sm text-[var(--foreground)]">
                  <div className="flex size-8 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/12 text-blue-600">
                    <ShoppingBag className="size-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs uppercase tracking-[0.24em] text-blue-500/70">
                      Logged in
                    </p>
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {user?.email || user?.displayName || 'admin@store'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
            <div className="admin-content-wrapper">
              <div className="admin-content-stack">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </AdminOnly>
  )
}
