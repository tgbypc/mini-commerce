'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type Role = 'admin' | 'user' | null

interface AuthContextType {
  user: User | null
  loading: boolean
  role: Role
  emailLogin: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser)
          // Firestore'dan rol bilgisini çek
          try {
            const ref = doc(db, 'users', firebaseUser.uid)
            const snap = await getDoc(ref)
            if (snap.exists()) {
              const data = snap.data() as { role?: Role }
              setRole((data.role as Role) ?? 'user')
            } else {
              setRole('user') // varsayılan
            }
          } catch {
            setRole('user')
          }
        } else {
          setUser(null)
          setRole(null)
        }
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  async function emailLogin(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
    return auth.currentUser as User
  }

  async function logout() {
    await signOut(auth)
  }

  const value: AuthContextType = { user, loading, role, emailLogin, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
