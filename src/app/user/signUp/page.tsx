'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function SignupPage() {
  const { emailRegister, loading, user, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    try {
      await emailRegister(email, password)
    } catch (err) {
      console.error(err)
      alert('Signup error: ' + (err as Error).message)
    }
  }

  return (
    <div className="max-w-sm mx-auto p-4">
      {user ? (
        <div>
          <p className="mb-4">Logged in as: {user.email}</p>
          <button onClick={logout} className="bg-red-500 text-white px-4 py-2">
            Logout
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-bold mb-4">Sign Up</h1>
          <form onSubmit={handleSignup} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border p-2 w-full"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border p-2 w-full"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 w-full"
            >
              Sign Up
            </button>
          </form>
        </>
      )}
    </div>
  )
}
