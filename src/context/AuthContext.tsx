// src/context/AuthContext.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

type AuthContextType = {
  user: User | null
  loading: boolean
  ensureAnonUser: () => Promise<User>
  emailLogin: (email: string, password: string) => Promise<User>
  emailRegister: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    ;(async () => {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth)
        } catch {}
      }
    })()
    return () => unsub()
  }, [])

  async function ensureAnonUser() {
    if (auth.currentUser) return auth.currentUser
    await signInAnonymously(auth)
    return auth.currentUser!
  }
  async function emailLogin(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
    return auth.currentUser!
  }
  async function emailRegister(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password)
    return auth.currentUser!
  }
  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        ensureAnonUser,
        emailLogin,
        emailRegister,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
