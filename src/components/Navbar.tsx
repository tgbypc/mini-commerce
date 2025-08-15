'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function Navbar() {
  const [q, setQ] = useState('')
  const { user, role } = useAuth()
  const { count } = useCart()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    // arama yönlendirmesi eklenecekse buraya (/search?q=...)
  }

  return (
    <nav className="flex items-center justify-between whitespace-nowrap border-b border-[#e7edf4] px-10 py-3">
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
          {/* Login link for non-logged-in users */}
          {!user && (
            <Link className="text-sm font-medium" href="/user/login">
              Login
            </Link>
          )}
          {/* Logout button for logged-in users */}
          {user && (
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Çıkış
            </button>
          )}
          {/* Sadece adminlere görünür */}
          {role === 'admin' && (
            <Link
              className="text-sm font-medium leading-normal text-red-600"
              href="/admin"
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      {/* Sağ: arama + ikonlar + auth */}
      <div className="flex flex-1 justify-end gap-3 md:gap-8">
        {/* Arama */}
        <form onSubmit={onSubmit} className="flex min-w-40 h-10 max-w-64">
          <div className="flex w-full items-stretch rounded-xl h-full overflow-hidden">
            <div className="text-[#49739c] flex items-center justify-center pl-4 bg-[#e7edf4]">
              {/* Search icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
              </svg>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="flex-1 border-none bg-[#e7edf4] outline-none px-4 rounded-r-xl text-base"
            />
          </div>
        </form>

        {/* Favoriler (dummy) */}
        <button
          type="button"
          className="h-10 rounded-xl bg-[#e7edf4] px-2.5 font-bold inline-flex items-center justify-center"
          title="Favoriler"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="#0d141c"
          >
            <path d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32Z" />
          </svg>
        </button>

        {/* Sepet */}
        {/* Sepet */}
        <Link
          href="/cart"
          className="relative h-10 rounded-xl bg-[#e7edf4] px-2.5 font-bold inline-flex items-center justify-center"
          title="Sepet"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="#0d141c"
          >
            <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200ZM176,88a48,48,0,0,1-96,0,8,8,0,0,1,16,0,32,32,0,0,0,64,0,8,8,0,0,1,16,0Z" />
          </svg>

          {count > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-black text-white text-xs flex items-center justify-center">
              {count}
            </span>
          )}
        </Link>

        {/* Auth alanı kaldırıldı */}
      </div>
    </nav>
  )
}
