import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { auth as firebaseAuth } from '@/lib/firebase'

type AuthMock = {
  listeners: Array<
    (user: { uid: string; email?: string | null } | null) => Promise<void> | void
  >
  signInWithEmailAndPassword: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  onAuthStateChanged: ReturnType<typeof vi.fn>
}

const authMock = vi.hoisted(() => {
  const listeners: AuthMock['listeners'] = []
  const signInWithEmailAndPassword = vi.fn(async () => ({}))
  const signOut = vi.fn(async () => {})
  const onAuthStateChanged = vi.fn(
    (_auth, callback: AuthMock['listeners'][number]) => {
      listeners.push(callback)
      return () => {
        const index = listeners.indexOf(callback)
        if (index >= 0) listeners.splice(index, 1)
      }
    }
  )
  return {
    listeners,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
  }
}) as AuthMock

type FirestoreMock = {
  doc: ReturnType<typeof vi.fn>
  getDoc: ReturnType<typeof vi.fn>
  setDoc: ReturnType<typeof vi.fn>
  serverTimestamp: ReturnType<typeof vi.fn>
}

const firestoreMock = vi.hoisted(() => {
  const doc = vi.fn((_db, path, id) => ({ path: `${path}/${id}` }))
  const getDoc = vi.fn()
  const setDoc = vi.fn(async () => {})
  const serverTimestamp = vi.fn(() => 'ts')
  return { doc, getDoc, setDoc, serverTimestamp }
}) as FirestoreMock

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: authMock.onAuthStateChanged,
  signInWithEmailAndPassword: authMock.signInWithEmailAndPassword,
  signOut: authMock.signOut,
}))

vi.mock('firebase/firestore', () => ({
  doc: firestoreMock.doc,
  getDoc: (...args: Parameters<typeof firestoreMock.getDoc>) =>
    firestoreMock.getDoc(...args),
  setDoc: (...args: Parameters<typeof firestoreMock.setDoc>) =>
    firestoreMock.setDoc(...args),
  serverTimestamp: (...args: Parameters<typeof firestoreMock.serverTimestamp>) =>
    firestoreMock.serverTimestamp(...args),
}))

function TestConsumer() {
  const { user, role, loading, emailLogin, logout } = useAuth()
  return (
    <div>
      <span data-testid="user">{user?.uid ?? 'none'}</span>
      <span data-testid="role">{role ?? 'none'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <button
        data-testid="login"
        onClick={() => emailLogin('admin@example.com', 'secret')}
      >
        login
      </button>
      <button data-testid="logout" onClick={() => logout()}>
        logout
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    authMock.listeners.length = 0
    authMock.signInWithEmailAndPassword.mockClear()
    authMock.signOut.mockClear()
    firestoreMock.getDoc.mockReset()
    firestoreMock.setDoc.mockReset()
    firestoreMock.serverTimestamp.mockClear()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('seeds new admin user when email is listed', async () => {
    process.env.NEXT_PUBLIC_ADMIN_EMAILS = 'admin@example.com'
    firestoreMock.getDoc.mockResolvedValueOnce({
      exists: () => false,
    })

    const user = userEvent.setup()
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => expect(authMock.listeners.length).toBe(1))

    await act(async () => {
      await authMock.listeners[0]({
        uid: 'u1',
        email: 'admin@example.com',
      })
    })

    await waitFor(() =>
      expect(screen.getByTestId('role').textContent).toBe('admin')
    )
    expect(screen.getByTestId('user').textContent).toBe('u1')
    expect(firestoreMock.setDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        email: 'admin@example.com',
        role: 'admin',
      }),
      { merge: true }
    )

    await user.click(screen.getByTestId('login'))
    expect(authMock.signInWithEmailAndPassword).toHaveBeenCalledWith(
      firebaseAuth,
      'admin@example.com',
      'secret'
    )

    await user.click(screen.getByTestId('logout'))
    expect(authMock.signOut).toHaveBeenCalledWith(firebaseAuth)
  })

  it('loads existing user document and respects stored role', async () => {
    firestoreMock.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'user' }),
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => expect(authMock.listeners.length).toBe(1))

    await act(async () => {
      await authMock.listeners[0]({
        uid: 'u2',
        email: 'member@example.com',
      })
    })

    await waitFor(() =>
      expect(screen.getByTestId('role').textContent).toBe('user')
    )
    expect(firestoreMock.setDoc).not.toHaveBeenCalled()
  })

  it('throws when useAuth is called outside provider', () => {
    function Wrapper() {
      useAuth()
      return null
    }
    expect(() => render(<Wrapper />)).toThrowError(
      /useAuth must be used within <AuthProvider>/
    )
  })
})
