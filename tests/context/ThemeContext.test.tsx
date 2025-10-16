import React, { useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'

const STORAGE_KEY = 'mini-commerce-theme'

type MatchMediaListener = (event: MediaQueryListEvent) => void

function setupMatchMedia(initialMatches: boolean) {
  const listeners = new Set<MatchMediaListener>()
  const matchMediaMock = vi.fn().mockImplementation(() => ({
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: MatchMediaListener) => {
      listeners.add(listener)
    },
    removeEventListener: (_: string, listener: MatchMediaListener) => {
      listeners.delete(listener)
    },
    dispatchEvent: (event: MediaQueryListEvent) => {
      listeners.forEach((listener) => listener(event))
      return true
    },
  }))
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: matchMediaMock,
  })
  return {
    matchMediaMock,
    emit: (matches: boolean) => {
      listeners.forEach((listener) =>
        listener({ matches } as MediaQueryListEvent)
      )
    },
  }
}

function TestComponent() {
  const { theme, toggleTheme } = useTheme()
  useEffect(() => {
    ;(window as { __theme?: { theme: typeof theme; toggleTheme: typeof toggleTheme } }).__theme = {
      theme,
      toggleTheme,
    }
  }, [theme, toggleTheme])
  return (
    <button type="button" onClick={toggleTheme}>
      current:{theme}
    </button>
  )
}

function renderThemeProvider() {
  return render(
    <ThemeProvider>
      <TestComponent />
    </ThemeProvider>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    ;(window as { __theme?: { theme: string; toggleTheme: () => void } }).__theme =
      undefined
  })

  it('initializes from storage and updates DOM/localStorage on toggle', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    setupMatchMedia(false)

    renderThemeProvider()

    await waitFor(() =>
      expect(screen.getByRole('button').textContent).toContain('dark')
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByRole('button').textContent).toContain('light')
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
  })

  it('respects system preference when storage empty and reacts to changes', async () => {
    const media = setupMatchMedia(true)

    renderThemeProvider()

    await waitFor(() =>
      expect(screen.getByRole('button').textContent).toContain('dark')
    )

    localStorage.removeItem(STORAGE_KEY)

    act(() => media.emit(false))

    await waitFor(() =>
      expect(screen.getByRole('button').textContent).toContain('light')
    )
  })
})
