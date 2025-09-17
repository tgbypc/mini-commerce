'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
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

  // Admin emails (comma-separated) from env for quick bootstrapping
  const adminEmailSet = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
    const parts = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    return new Set(parts)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setLoading(true)
          setUser(firebaseUser)
          // Firestore'dan rol bilgisini çek; doküman yoksa otomatik oluştur (seed)
          try {
            const ref = doc(db, 'users', firebaseUser.uid)
            const snap = await getDoc(ref)

            // If email is listed as admin, enforce admin role and persist
            const emailLc = (firebaseUser.email || '').toLowerCase()
            const listedAdmin = emailLc && adminEmailSet.has(emailLc)

            if (!snap.exists()) {
              // İlk giriş: users/{uid} dokümanı oluştur
              const desiredRole: Role = listedAdmin ? 'admin' : 'user'
              await setDoc(
                ref,
                {
                  email: firebaseUser.email ?? '',
                  role: desiredRole,
                  createdAt: serverTimestamp(),
                },
                { merge: true }
              )
              setRole(desiredRole)
              console.log('AuthContext: role set to', desiredRole, '(seeded)')
            } else {
              const data = snap.data() as { role?: Role }
              let r = (data?.role as Role) ?? 'user'
              if (listedAdmin && r !== 'admin') {
                // Promote and persist
                await setDoc(ref, { role: 'admin', updatedAt: serverTimestamp() }, { merge: true })
                r = 'admin'
              }
              setRole(r)
              console.log('AuthContext: role set to', r)
            }
          } catch {
            setRole('user')
            console.log('AuthContext: role set to', 'user (fallback)')
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
