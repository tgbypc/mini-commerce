import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from '@/components/Navbar'
import { usePathname } from 'next/navigation'

const authState = vi.hoisted(() => ({
  user: null as null | { uid: string; displayName?: string; email?: string },
  role: null as 'admin' | 'user' | null,
  loading: false,
  logout: vi.fn(),
}))

const cartState = vi.hoisted(() => ({
  count: 0,
}))

const i18nState = vi.hoisted(() => ({
  locale: 'en',
  setLocale: vi.fn(),
  t: (key: string) => key,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/context/CartContext', () => ({
  useCart: () => cartState,
}))

vi.mock('@/context/I18nContext', () => ({
  useI18n: () => i18nState,
}))

vi.mock('@/components/ThemeToggle', () => ({
  __esModule: true,
  default: () => <div data-testid="theme-toggle" />,
}))

describe('Navbar', () => {
  beforeEach(() => {
    authState.user = null
    authState.role = null
    authState.loading = false
    authState.logout.mockReset()
    cartState.count = 0
    i18nState.locale = 'en'
    i18nState.setLocale.mockReset()
    vi.mocked(usePathname).mockReturnValue('/')
  })

  it('returns null on admin routes', () => {
    vi.mocked(usePathname).mockReturnValue('/admin/dashboard')
    const { container } = render(<Navbar />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows auth links when user is logged out', () => {
    render(<Navbar />)
    expect(screen.getByText('nav.login')).toBeInTheDocument()
    expect(screen.getByText('nav.register')).toBeInTheDocument()
  })

  it('renders admin link in profile menu for admin users', async () => {
    authState.user = { uid: '1', displayName: 'Ada Lovelace' }
    authState.role = 'admin'
    render(<Navbar />)

    const toggle = screen.getByRole('button', { name: /AL/ })
    await userEvent.click(toggle)

    expect(screen.getByRole('link', { name: 'nav.admin' })).toBeInTheDocument()
  })

  it('renders profile links and triggers logout for regular users', async () => {
    authState.user = { uid: '1', email: 'user@example.com' }
    authState.role = 'user'
    cartState.count = 3
    render(<Navbar />)

    const profileBtn = screen.getByRole('button', { name: /UE/ })
    await userEvent.click(profileBtn)

    expect(screen.getByRole('link', { name: 'nav.profile' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'nav.orders' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'nav.logout' }))
    expect(authState.logout).toHaveBeenCalled()
  })
})
