'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useI18n } from '@/context/I18nContext'
import ThemeToggle from '@/components/ThemeToggle'

const NAV_ITEMS: Array<{
  key: 'home' | 'store' | 'about' | 'contact'
  href: string
}> = [
  { key: 'home', href: '/' },
  { key: 'store', href: '/store' },
  { key: 'about', href: '/about' },
  { key: 'contact', href: '/contact' },
]

export default function Navbar() {
  const pathname = usePathname()
  const { t, locale, setLocale } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const { user, role, loading, logout } = useAuth()
  const { count } = useCart()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)

  const initials = useMemo(() => {
    const raw = user?.displayName || user?.email || ''
    const parts = raw.split(/[@\s\.]+/).filter(Boolean)
    const a = parts[0]?.[0]?.toUpperCase() || 'U'
    const b = parts[1]?.[0]?.toUpperCase() || ''
    return (a + b).slice(0, 2)
  }, [user])

  const iconButtonClass = 'relative theme-icon-button'

  function toggleMobileMenu() {
    setIsOpen((prev) => !prev)
    setProfileOpen(false)
  }

  function closeMobileMenu() {
    setIsOpen(false)
  }

  function closeProfileMenu() {
    setProfileOpen(false)
  }

  useEffect(() => {
    if (!profileOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const container = profileRef.current
      if (!container) return
      if (!container.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [profileOpen])

  if (pathname?.startsWith('/admin')) {
    return null
  }

  return (
    <header className="sticky top-0 z-40 bg-[var(--navbar-surface)] px-3 py-3 backdrop-blur transition-colors duration-200 md:px-6">
      <div className="navbar-card mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 rounded-[24px] px-3 py-2.5 md:px-5">
        <div className="flex flex-1 items-center gap-4 md:gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 text-[var(--foreground)] transition hover:opacity-90"
          >
            <div className="size-4">
              <svg
                viewBox="0 0 48 48"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M24 .76 47.24 24 24 47.24.76 24 24 .76ZM21 35.76V12.24L9.24 24 21 35.76Z" />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-[-0.015em]">
              MiniCommerce
            </span>
          </Link>

          <nav className="navbar-nav hidden md:flex items-center gap-1 rounded-full px-1 py-1">
            {NAV_ITEMS.map(({ key, href }) => {
              const isActive =
                href === '/'
                  ? pathname === '/'
                  : pathname?.startsWith(href) ?? false
              return (
                <Link
                  key={key}
                  href={href}
                  className="navbar-pill"
                  data-active={isActive ? 'true' : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {t(`nav.${key}`)}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/favorites"
            className={iconButtonClass}
            title={t('nav.favorites')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 32 32"
            >
              <path
                fill="currentColor"
                d="M22.45 6a5.47 5.47 0 0 1 3.91 1.64a5.7 5.7 0 0 1 0 8L16 26.13L5.64 15.64a5.7 5.7 0 0 1 0-8a5.48 5.48 0 0 1 7.82 0l2.54 2.6l2.53-2.58A5.44 5.44 0 0 1 22.45 6m0-2a7.47 7.47 0 0 0-5.34 2.24L16 7.36l-1.11-1.12a7.49 7.49 0 0 0-10.68 0a7.72 7.72 0 0 0 0 10.82L16 29l11.79-11.94a7.72 7.72 0 0 0 0-10.82A7.49 7.49 0 0 0 22.45 4Z"
              />
            </svg>
          </Link>

          <Link href="/cart" className={iconButtonClass} title={t('nav.cart')}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
            >
              <g fill="currentColor">
                <path d="M10 13.25a.75.75 0 0 0 0 1.5h4a.75.75 0 1 0 0-1.5h-4Z" />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M14.665 2.33a.75.75 0 0 1 1.006.335l1.813 3.626c.428.022.817.055 1.17.106c1.056.151 1.93.477 2.551 1.245c.621.769.757 1.691.684 2.755c-.07 1.031-.35 2.332-.698 3.957l-.451 2.107c-.235 1.097-.426 1.986-.666 2.68c-.25.725-.58 1.32-1.142 1.775c-.562.455-1.214.652-1.974.745c-.73.089-1.64.089-2.76.089H9.802c-1.122 0-2.031 0-2.761-.089c-.76-.093-1.412-.29-1.974-.745c-.563-.455-.892-1.05-1.142-1.774c-.24-.695-.43-1.584-.666-2.68l-.451-2.107c-.348-1.626-.627-2.927-.698-3.958c-.073-1.064.063-1.986.684-2.755c.62-.768 1.494-1.094 2.55-1.245c.353-.05.743-.084 1.17-.106L8.33 2.665a.75.75 0 0 1 1.342.67l-1.46 2.917c.364-.002.747-.002 1.149-.002h5.278c.402 0 .785 0 1.149.002l-1.459-2.917a.75.75 0 0 1 .335-1.006ZM5.732 7.858l-.403.806a.75.75 0 1 0 1.342.67l.787-1.574c.57-.01 1.22-.011 1.964-.011h5.156c.744 0 1.394 0 1.964.01l.787 1.575a.75.75 0 0 0 1.342-.67l-.403-.806l.174.023c.884.127 1.317.358 1.597.703c.275.34.41.803.356 1.665H3.605c-.054-.862.081-1.325.356-1.665c.28-.345.713-.576 1.597-.703l.174-.023Z"
                />
              </g>
            </svg>
            {count > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-primary-dark)] px-1 text-[11px] font-semibold text-white">
                {count}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-1 rounded-full border border-[var(--btn-outline-border)] bg-[var(--btn-outline-bg)] p-1 transition-colors duration-200">
            {(['en', 'nb'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                  locale === code
                    ? 'bg-[var(--color-primary-dark)] text-white shadow-[0_8px_18px_rgba(91,91,214,0.3)] hover:-translate-y-0.5'
                    : 'text-[var(--btn-outline-text)] hover:-translate-y-0.5 hover:bg-[rgba(99,102,241,0.12)] hover:text-[var(--color-primary-dark)]'
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          {!loading && !user && (
            <div className="flex items-center gap-2">
              <Link href="/user/login" className="btn-outline px-4 py-1.5">
                {t('nav.login')}
              </Link>
              <Link href="/user/register" className="btn-primary px-4 py-1.5">
                {t('nav.register')}
              </Link>
            </div>
          )}

          {!loading && user && (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="theme-icon-button font-semibold uppercase tracking-tight text-[var(--foreground)]"
              >
                {initials}
              </button>
              {profileOpen && (
                <div className="navbar-mobile-panel absolute right-0 mt-2 w-52 rounded-2xl p-2">
                  {role === 'admin' ? (
                    <Link
                      href="/admin"
                      onClick={closeProfileMenu}
                      className="navbar-dropdown-link"
                    >
                      {t('nav.admin')}
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/user/profile"
                        onClick={closeProfileMenu}
                        className="navbar-dropdown-link"
                      >
                        {t('nav.profile')}
                      </Link>
                      <Link
                        href="/user/orders"
                        onClick={closeProfileMenu}
                        className="navbar-dropdown-link"
                      >
                        {t('nav.orders')}
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      closeProfileMenu()
                      logout()
                    }}
                    className="navbar-dropdown-danger mt-1"
                  >
                    {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="theme-icon-button md:hidden"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          onClick={toggleMobileMenu}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="navbar-mobile-panel mx-auto mt-3 w-full max-w-[1100px] rounded-2xl p-4 md:hidden">
          <nav className="grid gap-2">
            {NAV_ITEMS.map(({ key, href }) => {
              const isActive =
                href === '/'
                  ? pathname === '/'
                  : pathname?.startsWith(href) ?? false
              return (
                <Link
                  key={`mobile-${key}`}
                  href={href}
                  onClick={closeMobileMenu}
                  className="navbar-mobile-link justify-between"
                  data-active={isActive ? 'true' : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {t(`nav.${key}`)}
                </Link>
              )
            })}
          </nav>

          <div className="mt-4 flex justify-center">
            <ThemeToggle />
          </div>

          <div className="mt-4 grid gap-3">
            <Link
              href="/favorites"
              onClick={closeMobileMenu}
              className="navbar-mobile-link justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 32 32"
              >
                <path
                  fill="currentColor"
                  d="M22.45 6a5.47 5.47 0 0 1 3.91 1.64a5.7 5.7 0 0 1 0 8L16 26.13L5.64 15.64a5.7 5.7 0 0 1 0-8a5.48 5.48 0 0 1 7.82 0l2.54 2.6l2.53-2.58A5.44 5.44 0 0 1 22.45 6m0-2a7.47 7.47 0 0 0-5.34 2.24L16 7.36l-1.11-1.12a7.49 7.49 0 0 0-10.68 0a7.72 7.72 0 0 0 0 10.82L16 29l11.79-11.94a7.72 7.72 0 0 0 0-10.82A7.49 7.49 0 0 0 22.45 4Z"
                />
              </svg>
              {t('nav.favorites')}
            </Link>
            <Link
              href="/cart"
              onClick={closeMobileMenu}
              className="navbar-mobile-link justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <g fill="currentColor">
                  <path d="M10 13.25a.75.75 0 0 0 0 1.5h4a.75.75 0 1 0 0-1.5h-4Z" />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M14.665 2.33a.75.75 0 0 1 1.006.335l1.813 3.626c.428.022.817.055 1.17.106c1.056.151 1.93.477 2.551 1.245c.621.769.757 1.691.684 2.755c-.07 1.031-.35 2.332-.698 3.957l-.451 2.107c-.235 1.097-.426 1.986-.666 2.68c-.25.725-.58 1.32-1.142 1.775c-.562.455-1.214.652-1.974.745c-.73.089-1.64.089-2.76.089H9.802c-1.122 0-2.031 0-2.761-.089c-.76-.093-1.412-.29-1.974-.745c-.563-.455-.892-1.05-1.142-1.774c-.24-.695-.43-1.584-.666-2.68l-.451-2.107c-.348-1.626-.627-2.927-.698-3.958c-.073-1.064.063-1.986.684-2.755c.62-.768 1.494-1.094 2.55-1.245c.353-.05.743-.084 1.17-.106L8.33 2.665a.75.75 0 0 1 1.342.67l-1.46 2.917c.364-.002.747-.002 1.149-.002h5.278c.402 0 .785 0 1.149.002l-1.459-2.917a.75.75 0 0 1 .335-1.006ZM5.732 7.858l-.403.806a.75.75 0 1 0 1.342.67l.787-1.574c.57-.01 1.22-.011 1.964-.011h5.156c.744 0 1.394 0 1.964.01l.787 1.575a.75.75 0 0 0 1.342-.67l-.403-.806l.174.023c.884.127 1.317.358 1.597.703c.275.34.41.803.356 1.665H3.605c-.054-.862.081-1.325.356-1.665c.28-.345.713-.576 1.597-.703l.174-.023Z"
                  />
                </g>
              </svg>
              {t('nav.cart')}
              {count > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[var(--color-primary-dark)] px-2 text-xs font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {(['en', 'nb'] as const).map((code) => (
              <button
                key={`mobile-locale-${code}`}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  locale === code
                    ? 'bg-[var(--color-primary-dark)] text-white shadow-[0_12px_26px_rgba(91,91,214,0.35)] hover:-translate-y-0.5'
                    : 'border border-[var(--btn-outline-border)] bg-[var(--btn-outline-bg)] text-[var(--btn-outline-text)] hover:-translate-y-0.5 hover:bg-[var(--btn-outline-bg-hover)] hover:text-[var(--color-primary-dark)]'
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          {!loading && !user && (
            <div className="mt-4 grid gap-2">
              <Link
                href="/user/login"
                onClick={closeMobileMenu}
                className="rounded-xl border border-[var(--btn-outline-border)] bg-[var(--btn-outline-bg)] px-3 py-2 text-center text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--btn-outline-bg-hover)] hover:text-[var(--color-primary-dark)]"
              >
                {t('nav.login')}
              </Link>
              <Link
                href="/user/register"
                onClick={closeMobileMenu}
                className="rounded-xl bg-[var(--color-primary-dark)] px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
              >
                {t('nav.register')}
              </Link>
            </div>
          )}

          {!loading && user && (
            <div className="mt-4 grid gap-2">
              {role === 'admin' ? (
                <Link
                  href="/admin"
                  onClick={closeMobileMenu}
                  className="rounded-xl border border-[var(--btn-outline-border)] bg-[var(--btn-outline-bg)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--btn-outline-bg-hover)] hover:text-[var(--color-primary-dark)]"
                >
                  {t('nav.admin')}
                </Link>
              ) : (
                <>
                  <Link
                    href="/user/profile"
                    onClick={closeMobileMenu}
                    className="rounded-xl border border-[var(--btn-outline-border)] bg-[var(--btn-outline-bg)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--btn-outline-bg-hover)] hover:text-[var(--color-primary-dark)]"
                  >
                    {t('nav.profile')}
                  </Link>
                  <Link
                    href="/user/orders"
                    onClick={closeMobileMenu}
                    className="rounded-xl border border-[var(--btn-outline-border)] bg-[var(--btn-outline-bg)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--btn-outline-bg-hover)] hover:text-[var(--color-primary-dark)]"
                  >
                    {t('nav.orders')}
                  </Link>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu()
                  logout()
                }}
                className="rounded-xl bg-[#fef2f2] px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-[#fee2e2]"
              >
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
