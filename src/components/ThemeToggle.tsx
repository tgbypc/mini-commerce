'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/context/ThemeContext'

type ThemeToggleProps = {
  className?: string
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && theme === 'dark'

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`theme-icon-button ${className ?? ''}`.trim()}
    >
      {mounted ? (
        isDark ? (
          <MoonIcon />
        ) : (
          <SunIcon />
        )
      ) : (
        <div className="h-5 w-5" />
      )}
    </button>
  )
}

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 3v2.5M12 18.5V21M4.929 4.929l1.768 1.768M17.303 17.303l1.768 1.768M3 12h2.5M18.5 12H21M4.929 19.071l1.768-1.768M17.303 6.697l1.768-1.768"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 0 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
      />
    </svg>
  )
}
