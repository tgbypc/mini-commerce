import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AdminOnly from '@/components/AdminOnly'
import { useRouter } from 'next/navigation'

const authState = vi.hoisted(() => ({
  user: null as null | { uid: string },
  role: null as 'admin' | 'user' | null,
  loading: false,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

describe('AdminOnly', () => {
  it('renders children when user is admin', async () => {
    authState.user = { uid: '123' }
    authState.role = 'admin'
    authState.loading = false

    render(
      <AdminOnly>
        <div data-testid="protected">Admin content</div>
      </AdminOnly>
    )

    expect(await screen.findByTestId('protected')).toBeInTheDocument()
  })

  it('redirects non-admin users to login', async () => {
    const replace = vi.fn()
    vi.mocked(useRouter).mockReturnValue(
      {
        replace,
        push: vi.fn(),
        refresh: vi.fn(),
        back: vi.fn(),
      } as ReturnType<typeof useRouter>
    )

    authState.user = { uid: '123' }
    authState.role = 'user'
    authState.loading = false

    render(
      <AdminOnly>
        <div>Should not render</div>
      </AdminOnly>
    )

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/user/login?next=/admin')
    )
    expect(screen.queryByText('Should not render')).not.toBeInTheDocument()
  })

  it('returns null while loading', () => {
    authState.user = null
    authState.role = null
    authState.loading = true

    const { container } = render(
      <AdminOnly>
        <div>Loading state</div>
      </AdminOnly>
    )

    expect(container).toBeEmptyDOMElement()
  })
})
