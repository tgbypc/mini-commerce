'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function Navbar() {
  const [q, setQ] = useState('')
  const { user, logout } = useAuth()

  const [dark, setDark] = useState(false)
  // initialize from DOM on mount
  useEffect(() => {
    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    setDark(isDark)
  }, [])
  function toggleTheme() {
    const el = document.documentElement
    const next = !el.classList.contains('dark')
    el.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
    setDark(next)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    // arama yönlendirmesi eklenecekse buraya
  }

  return (
    <nav className="flex items-center justify-between whitespace-nowrap border-b border-[#e7edf4] px-10 py-3">
      {/* Logo ve Menü */}
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="flex items-center gap-4 text-[#0d141c] hover:opacity-90"
        >
          <div className="size-4">
            <svg viewBox="0 0 48 48" fill="currentColor">
              <path d="M24 .76 47.24 24 24 47.24.76 24 24 .76ZM21 35.76V12.24L9.24 24 21 35.76Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold tracking-[-0.015em]">
            MiniCommerce
          </h2>
        </Link>

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
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user.email ?? 'Guest'}
              </span>
              <button
                onClick={logout}
                className="text-sm font-medium text-red-600 hover:underline"
              >
                Çıkış
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/user/login" className="text-sm font-medium px-3">
                Login
              </Link>
              <Link href="/user/signup" className="text-sm font-medium px-3">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Arama ve ikonlar */}
      <div className="flex flex-1 justify-end gap-3 md:gap-8">
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

        {/* Favoriler */}
        <button className="h-10 rounded-xl bg-[#e7edf4] px-2.5 font-bold">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="#0d141c"
          >
            <path d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32Z" />
          </svg>
        </button>

        {/* Tema (Dark/Light) */}
        <button
          onClick={toggleTheme}
          className="h-10 rounded-xl bg-[#e7edf4] px-2.5 font-bold inline-flex items-center justify-center"
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? (
            // sun icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="#0d141c"
              viewBox="0 0 256 256"
            >
              <path d="M128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Zm0-52a12,12,0,0,1,12,12V60a12,12,0,0,1-24,0V44A12,12,0,0,1,128,32Zm0,192a12,12,0,0,1,12,12v16a12,12,0,0,1-24,0V236A12,12,0,0,1,128,224ZM44,116H28a12,12,0,0,1,0-24H44a12,12,0,0,1,0,24Zm184,0H212a12,12,0,0,1,0-24h16a12,12,0,0,1,0,24ZM54.63,54.63a12,12,0,0,1,17-17l11.31,11.31a12,12,0,0,1-17,17ZM173.05,173.05a12,12,0,0,1,17,0l11.31,11.31a12,12,0,1,1-17,17L173.05,190.05A12,12,0,0,1,173.05,173.05ZM54.63,201.37l11.31-11.31a12,12,0,1,1,17,17L71.63,218.37a12,12,0,0,1-17-17ZM201.37,54.63,190.05,65.94a12,12,0,0,1-17-17L184.37,37.63a12,12,0,0,1,17,17Z" />
            </svg>
          ) : (
            // moon icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="#0d141c"
              viewBox="0 0 256 256"
            >
              <path d="M228.39,146.13a92,92,0,1,1-118.52-118.5,4,4,0,0,1,4.82,5.77,76,76,0,0,0,107.43,107.43A4,4,0,0,1,228.39,146.13Z" />
            </svg>
          )}
        </button>

        {/* Sepet */}
        <Link
          href="/cart"
          className="h-10 rounded-xl bg-[#e7edf4] px-2.5 font-bold inline-flex items-center justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="#0d141c"
          >
            <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200ZM176,88a48,48,0,0,1-96,0,8,8,0,0,1,16,0,32,32,0,0,0,64,0,8,8,0,0,1,16,0Z" />
          </svg>
        </Link>
      </div>
    </nav>
  )
}
