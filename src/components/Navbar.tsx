'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useFavorites } from '@/context/FavoritesContext'

export default function Navbar() {
  const [q, setQ] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const { user, role, loading, logout } = useAuth()
  const { count } = useCart()
  const { count: favCount } = useFavorites()
  const [profileOpen, setProfileOpen] = useState(false)
  const initials = useMemo(() => {
    const n = user?.displayName || user?.email || ''
    const parts = n.split(/[@\s\.]+/).filter(Boolean)
    const a = parts[0]?.[0]?.toUpperCase() || 'U'
    const b = parts[1]?.[0]?.toUpperCase() || ''
    return (a + b).slice(0, 2)
  }, [user])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    // arama yönlendirmesi eklenecekse buraya (/search?q=...)
  }

  return (
    <nav className="relative flex items-center justify-between whitespace-nowrap border-b border-[#e7edf4] px-4 md:px-10 py-3">
      {/* Sol: Logo + menü */}
      <div className="flex items-center gap-8">
        {/* Logo + title (anasayfa linki) */}
        <Link
          href="/"
          className="flex items-center gap-4 text-[#0d141c] hover:opacity-90"
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
          <h2 className="text-lg font-bold tracking-[-0.015em]">
            MiniCommerce
          </h2>
        </Link>

        {/* Hamburger (mobile) */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-[#0d141c] hover:bg-[#e7edf4] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#cedbe8]"
          aria-label={isOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
        >
          {/* Hamburger icon */}
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

        {/* Ana menü */}
        <div className="hidden md:flex items-center gap-9">
          <Link className="text-sm font-medium" href="/">
            Ana Sayfa
          </Link>
          <Link className="text-sm font-medium" href="#">
            Mağaza
          </Link>
          <Link className="text-sm font-medium" href="#">
            Hakkımızda
          </Link>
          <Link className="text-sm font-medium" href="#">
            İletişim
          </Link>
          {/* Auth UI */}
          {!user ? (
            <>
              <Link className="text-sm font-medium" href="/user/login">Login</Link>
              <Link className="text-sm font-medium" href="/user/register">Register</Link>
            </>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="inline-flex items-center justify-center size-9 rounded-full bg-[#e7edf4] text-[#0d141c] hover:opacity-90"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                <span className="text-xs font-semibold">{initials}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border bg-white shadow-lg p-2 z-50">
                  <Link
                    href="/user/profile"
                    onClick={() => setProfileOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Profilim
                  </Link>
                  <Link
                    href="/user/orders"
                    onClick={() => setProfileOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Siparişlerim
                  </Link>
                  {role === 'admin' && (
                    <Link
                      href="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                    >
                      Admin Paneli
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); logout() }}
                    className="block w-full text-left rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-zinc-50"
                  >
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sağ: arama + ikonlar + auth */}
      <div className="hidden md:flex flex-1 justify-end gap-3 md:gap-8">
        {/* Arama */}
        <form onSubmit={onSubmit} className="flex min-w-40 h-10 max-w-64">
          <div className="flex w-full items-stretch rounded-xl h-full overflow-hidden">
            <div className="text-[#49739c] flex items-center justify-center pl-4 bg-[#e7edf4]">
              {/* Search icon */}
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="flex-1 border-none bg-[#e7edf4] outline-none px-4 rounded-r-xl text-base"
            />
          </div>
        </form>

        {/* Favoriler */}
        <Link
          href="/favorites"
          className="relative h-10 rounded-xl bg-[#e7edf4] px-2.5 font-bold inline-flex items-center justify-center"
          title="Favoriler"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 32 32">
            <path fill="currentColor" d="M22.45 6a5.47 5.47 0 0 1 3.91 1.64a5.7 5.7 0 0 1 0 8L16 26.13L5.64 15.64a5.7 5.7 0 0 1 0-8a5.48 5.48 0 0 1 7.82 0l2.54 2.6l2.53-2.58A5.44 5.44 0 0 1 22.45 6m0-2a7.47 7.47 0 0 0-5.34 2.24L16 7.36l-1.11-1.12a7.49 7.49 0 0 0-10.68 0a7.72 7.72 0 0 0 0 10.82L16 29l11.79-11.94a7.72 7.72 0 0 0 0-10.82A7.49 7.49 0 0 0 22.45 4Z" />
          </svg>
          {favCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-black text-white text-xs flex items-center justify-center">
              {favCount}
            </span>
          )}
        </Link>

        {/* Sepet */}
        <Link
          href="/cart"
          className="relative h-10 rounded-xl bg-[#e7edf4] px-2.5 font-bold inline-flex items-center justify-center"
          title="Sepet"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="30"
            height="30"
            viewBox="0 0 24 24"
          >
            <g fill="currentColor">
              <path d="M10 13.25a.75.75 0 0 0 0 1.5h4a.75.75 0 1 0 0-1.5h-4Z" />
              <path
                fillRule="evenodd"
                d="M14.665 2.33a.75.75 0 0 1 1.006.335l1.813 3.626c.428.022.817.055 1.17.106c1.056.151 1.93.477 2.551 1.245c.621.769.757 1.691.684 2.755c-.07 1.031-.35 2.332-.698 3.957l-.451 2.107c-.235 1.097-.426 1.986-.666 2.68c-.25.725-.58 1.32-1.142 1.775c-.562.455-1.214.652-1.974.745c-.73.089-1.64.089-2.76.089H9.802c-1.122 0-2.031 0-2.761-.089c-.76-.093-1.412-.29-1.974-.745c-.563-.455-.892-1.05-1.142-1.774c-.24-.695-.43-1.584-.666-2.68l-.451-2.107c-.348-1.626-.627-2.927-.698-3.958c-.073-1.064.063-1.986.684-2.755c.62-.768 1.494-1.094 2.55-1.245c.353-.05.743-.084 1.17-.106L8.33 2.665a.75.75 0 0 1 1.342.67l-1.46 2.917c.364-.002.747-.002 1.149-.002h5.278c.402 0 .785 0 1.149.002l-1.459-2.917a.75.75 0 0 1 .335-1.006ZM5.732 7.858l-.403.806a.75.75 0 1 0 1.342.67l.787-1.574c.57-.01 1.22-.011 1.964-.011h5.156c.744 0 1.394 0 1.964.01l.787 1.575a.75.75 0 0 0 1.342-.67l-.403-.806l.174.023c.884.127 1.317.358 1.597.703c.275.34.41.803.356 1.665H3.605c-.054-.862.081-1.325.356-1.665c.28-.345.713-.576 1.597-.703l.174-.023ZM4.288 14.1a81.117 81.117 0 0 1-.481-2.35h16.386a82.85 82.85 0 0 1-.482 2.35l-.428 2c-.248 1.155-.42 1.954-.627 2.552c-.2.58-.404.886-.667 1.098c-.262.212-.605.348-1.212.422c-.629.077-1.447.078-2.628.078H9.85c-1.18 0-1.998-.001-2.627-.078c-.608-.074-.95-.21-1.212-.422c-.263-.212-.468-.519-.667-1.098c-.207-.598-.38-1.397-.627-2.552l-.429-2Z"
                clipRule="evenodd"
              />
            </g>
          </svg>

          {count > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-black text-white text-xs flex items-center justify-center">
              {count}
            </span>
          )}
        </Link>

        {/* Auth alanı kaldırıldı */}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 md:hidden border-b border-[#e7edf4] bg-white">
          <div className="px-4 py-3 space-y-3">
            <form onSubmit={onSubmit} className="w-full">
              <div className="flex w-full items-stretch rounded-xl h-10 overflow-hidden">
                <div className="text-[#49739c] flex items-center justify-center pl-4 bg-[#e7edf4]">
                  {/* search icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 256 256"
                    fill="currentColor"
                  >
                    <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                  </svg>
                </div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  className="flex-1 border-none bg-[#e7edf4] outline-none px-4 text-base"
                />
              </div>
            </form>

            <div className="flex flex-col divide-y divide-[#e7edf4]">
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="py-2 text-sm font-medium"
              >
                Ana Sayfa
              </Link>
              <Link
                href="#"
                onClick={() => setIsOpen(false)}
                className="py-2 text-sm font-medium"
              >
                Mağaza
              </Link>
              <Link
                href="#"
                onClick={() => setIsOpen(false)}
                className="py-2 text-sm font-medium"
              >
                Hakkımızda
              </Link>
              <Link
                href="#"
                onClick={() => setIsOpen(false)}
                className="py-2 text-sm font-medium"
              >
                İletişim
              </Link>
              {!loading && user && (
                <Link
                  href="/user/profile"
                  onClick={() => setIsOpen(false)}
                  className="py-2 text-sm font-medium"
                >
                  Profilim
                </Link>
              )}
              {!loading && role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="py-2 text-sm font-medium"
                >
                  Admin
                </Link>
              )}
              {!user ? (
                <div className="flex gap-4 py-2">
                  <Link
                    href="/user/login"
                    onClick={() => setIsOpen(false)}
                    className="text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    href="/user/register"
                    onClick={() => setIsOpen(false)}
                    className="text-sm font-medium"
                  >
                    Register
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    logout()
                  }}
                  className="py-2 text-left text-sm font-medium text-red-600"
                >
                  Çıkış
                </button>
              )}
              <Link
                href="/favorites"
                onClick={() => setIsOpen(false)}
                className="py-2 text-sm font-medium inline-flex items-center gap-2"
              >
                <span>Favoriler</span>
                {/* (opsiyonel) kalp ikonu */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M22.45 6a5.47 5.47 0 0 1 3.91 1.64a5.7 5.7 0 0 1 0 8L16 26.13L5.64 15.64a5.7 5.7 0 0 1 0-8a5.48 5.48 0 0 1 7.82 0l2.54 2.6l2.53-2.58A5.44 5.44 0 0 1 22.45 6m0-2a7.47 7.47 0 0 0-5.34 2.24L16 7.36l-1.11-1.12a7.49 7.49 0 0 0-10.68 0a7.72 7.72 0 0 0 0 10.82L16 29l11.79-11.94a7.72 7.72 0 0 0 0-10.82A7.49 7.49 0 0 0 22.45 4Z"
                  />
                </svg>
              </Link>
              <Link
                href="/cart"
                onClick={() => setIsOpen(false)}
                className="py-2 text-sm font-medium inline-flex items-center gap-2"
              >
                <span>Sepet</span>
                {count > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-black text-white text-xs flex items-center justify-center">
                    {count}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
