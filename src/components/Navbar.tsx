'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useI18n } from '@/context/I18nContext'

const NAV_ITEMS: Array<{ key: 'home' | 'store' | 'about' | 'contact'; href: string }> = [
  { key: 'home', href: '/' },
  { key: 'store', href: '#' },
  { key: 'about', href: '#' },
  { key: 'contact', href: '#' },
]

export default function Navbar() {
  const { t, locale, setLocale } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const { user, role, loading, logout } = useAuth()
  const { count } = useCart()
  const [profileOpen, setProfileOpen] = useState(false)

  const initials = useMemo(() => {
    const raw = user?.displayName || user?.email || ''
    const parts = raw.split(/[@\s\.]+/).filter(Boolean)
    const a = parts[0]?.[0]?.toUpperCase() || 'U'
    const b = parts[1]?.[0]?.toUpperCase() || ''
    return (a + b).slice(0, 2)
  }, [user])

  const iconButtonClass =
    'relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-[#f4f4f5] text-[#0d141c] transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d141c]'

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

  return (
    <header className="sticky top-0 z-40 bg-white/70 px-3 py-3 backdrop-blur md:px-6">
      <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 rounded-[24px] border border-zinc-200/80 bg-white/85 px-3 py-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] md:px-5">
        <div className="flex flex-1 items-center gap-4 md:gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 text-[#0d141c] transition hover:opacity-90"
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
            <span className="text-lg font-semibold tracking-[-0.015em]">MiniCommerce</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 rounded-full border border-zinc-200 bg-[#f4f4f5] px-1 py-1">
            {NAV_ITEMS.map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-[#0d141c] transition hover:bg-white hover:shadow-sm"
              >
                {t(`nav.${key}`)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/favorites" className={iconButtonClass} title={t('nav.favorites')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32">
              <path
                fill="currentColor"
                d="M22.45 6a5.47 5.47 0 0 1 3.91 1.64a5.7 5.7 0 0 1 0 8L16 26.13L5.64 15.64a5.7 5.7 0 0 1 0-8a5.48 5.48 0 0 1 7.82 0l2.54 2.6l2.53-2.58A5.44 5.44 0 0 1 22.45 6m0-2a7.47 7.47 0 0 0-5.34 2.24L16 7.36l-1.11-1.12a7.49 7.49 0 0 0-10.68 0a7.72 7.72 0 0 0 0 10.82L16 29l11.79-11.94a7.72 7.72 0 0 0 0-10.82A7.49 7.49 0 0 0 22.45 4Z"
              />
            </svg>
          </Link>

          <Link href="/cart" className={iconButtonClass} title={t('nav.cart')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
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
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0d141c] px-1 text-[11px] font-semibold text-white">
                {count}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-[#f4f4f5] p-1">
            {(['en', 'nb'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                  locale === code ? 'bg-[#0d141c] text-white shadow-sm' : 'text-[#0d141c] hover:bg-white'
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          {!loading && !user && (
            <div className="flex items-center gap-2">
              <Link
                href="/user/login"
                className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-[#0d141c] transition hover:bg-white hover:shadow-sm"
              >
                {t('nav.login')}
              </Link>
              <Link
                href="/user/register"
                className="inline-flex items-center rounded-full bg-[#0d141c] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#1f2a37]"
              >
                {t('nav.register')}
              </Link>
            </div>
          )}

          {!loading && user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="inline-flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-[#f4f4f5] text-sm font-semibold text-[#0d141c] transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d141c]"
              >
                {initials}
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
                  {role === 'admin' ? (
                    <Link
                      href="/admin"
                      onClick={closeProfileMenu}
                      className="block rounded-xl px-3 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-[#f4f4f5]"
                    >
                      {t('nav.admin')}
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/user/profile"
                        onClick={closeProfileMenu}
                        className="block rounded-xl px-3 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-[#f4f4f5]"
                      >
                        {t('nav.profile')}
                      </Link>
                      <Link
                        href="/user/orders"
                        onClick={closeProfileMenu}
                        className="block rounded-xl px-3 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-[#f4f4f5]"
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
                    className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-[#fef2f2]"
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
          className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white p-2 text-[#0d141c] shadow-sm transition hover:bg-[#f4f4f5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d141c] md:hidden"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          onClick={toggleMobileMenu}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="mx-auto mt-3 w-full max-w-[1100px] rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-xl md:hidden">
          <nav className="grid gap-2">
            {NAV_ITEMS.map(({ key, href }) => (
              <Link
                key={`mobile-${key}`}
                href={href}
                onClick={closeMobileMenu}
                className="rounded-xl px-3 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-[#f4f4f5]"
              >
                {t(`nav.${key}`)}
              </Link>
            ))}
          </nav>

          <div className="mt-4 flex items-center gap-3">
            <Link
              href="/favorites"
              onClick={closeMobileMenu}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-[#f4f4f5] px-3 py-2 text-sm font-semibold text-[#0d141c]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 32 32">
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
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-[#f4f4f5] px-3 py-2 text-sm font-semibold text-[#0d141c]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
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
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[#0d141c] px-2 text-xs font-semibold text-white">
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
                  locale === code ? 'bg-[#0d141c] text-white' : 'border border-zinc-200 bg-[#f4f4f5] text-[#0d141c]'
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
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-center text-sm font-medium text-[#0d141c]"
              >
                {t('nav.login')}
              </Link>
              <Link
                href="/user/register"
                onClick={closeMobileMenu}
                className="rounded-xl bg-[#0d141c] px-3 py-2 text-center text-sm font-semibold text-white"
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
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-[#0d141c]"
                >
                  {t('nav.admin')}
                </Link>
              ) : (
                <>
                  <Link
                    href="/user/profile"
                    onClick={closeMobileMenu}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-[#0d141c]"
                  >
                    {t('nav.profile')}
                  </Link>
                  <Link
                    href="/user/orders"
                    onClick={closeMobileMenu}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-[#0d141c]"
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
                className="rounded-xl bg-[#fef2f2] px-3 py-2 text-sm font-semibold text-red-600"
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
