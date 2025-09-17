'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Timestamp, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type OrderItem = {
  description?: string
  quantity: number
  amountSubtotal?: number // cents
  amountTotal?: number // cents
  priceId?: string | null
}

type OrderDoc = {
  id: string
  amountTotal?: number | null // major currency
  currency?: string | null
  createdAt?: Timestamp | Date | null
  items?: OrderItem[]
}

const fmtMajor = (amountMajor = 0, currency = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(
    amountMajor || 0
  )

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderDoc[]>([])
  const [saving, setSaving] = useState(false)
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    phone: '',
    address: '',
  })

  useEffect(() => {
    const run = async () => {
      if (authLoading) return
      if (!user) {
        setOrders([])
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const token = await user.getIdToken()
        const res = await fetch('/api/user/orders', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Orders fetch failed')
        const data = (await res.json()) as OrderDoc[]
        setOrders(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [user, authLoading])

  // Load editable profile from Firestore (users/{uid})
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (authLoading || !user) return
      try {
        const ref = doc(db, 'users', user.uid)
        const snap = await getDoc(ref)
        if (!cancelled && snap.exists()) {
          const d = snap.data() as {
            displayName?: string
            phone?: string
            address?: string
          }
          setProfileForm({
            displayName: d.displayName ?? (user.displayName || ''),
            phone: d.phone ?? '',
            address: d.address ?? '',
          })
        } else if (!cancelled) {
          setProfileForm({
            displayName: user.displayName || '',
            phone: '',
            address: '',
          })
        }
      } catch (e) {
        console.error(e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [user, authLoading])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      const ref = doc(db, 'users', user.uid)
      await setDoc(
        ref,
        {
          displayName: profileForm.displayName?.trim() || '',
          phone: profileForm.phone?.trim() || '',
          address: profileForm.address?.trim() || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    } finally {
      setSaving(false)
    }
  }

  if (!user && !authLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Profilim</h1>
        <p className="mt-2 text-zinc-600">Devam etmek için lütfen giriş yapın.</p>
        <Link
          href="/user/login"
          className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Giriş Yap
        </Link>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="h-6 w-48 bg-gray-200 rounded mb-3 animate-pulse" />
        <div className="h-4 w-72 bg-gray-100 rounded mb-5 animate-pulse" />
        <div className="h-24 w-full bg-gray-50 rounded animate-pulse" />
      </div>
    )
  }

  const profile = {
    email: user?.email ?? '',
    uid: user?.uid ?? '',
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profilim</h1>
        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
        >
          Çıkış Yap
        </button>
      </div>

      {/* Hesap bilgileri */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Hesap Bilgileri</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-zinc-50 p-3">
            <div className="text-xs text-zinc-600">Email</div>
            <div className="text-sm">{profile.email}</div>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3">
            <div className="text-xs text-zinc-600">Kullanıcı ID</div>
            <div className="text-sm">{profile.uid}</div>
          </div>
        </div>

        {/* Editable profile fields */}
        <form onSubmit={saveProfile} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-zinc-700">Ad Soyad</label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, displayName: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Ad Soyad"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-700">Telefon</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, phone: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="05xx xxx xx xx"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-700">Adres</label>
            <textarea
              value={profileForm.address}
              onChange={(e) =>
                setProfileForm((p) => ({ ...p, address: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              rows={3}
              placeholder="Adres Bilgisi"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>

      {/* Siparişler (özet) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Son Siparişler</h2>
          <Link href="/user/orders" className="text-sm font-medium underline">Tümünü Gör</Link>
        </div>
        {!orders.length ? (
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-zinc-600">Henüz bir siparişiniz yok.</p>
            <div className="pt-3">
              <Link
                href="/"
                className="inline-flex rounded-xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Alışverişe Devam Et
              </Link>
            </div>
          </div>
        ) : (
          orders.slice(0, 3).map((o) => {
            const date =
              o.createdAt instanceof Timestamp
                ? o.createdAt.toDate()
                : o.createdAt instanceof Date
                ? o.createdAt
                : null
            const when = date ? date.toLocaleString('tr-TR') : ''
            const count = o.items?.reduce((n, it) => n + (it.quantity ?? 0), 0) ?? 0
            const currency = (o.currency ?? 'TRY').toUpperCase()

            return (
              <div key={o.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-zinc-600">Sipariş No</div>
                    <div className="text-base font-semibold">#{o.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-zinc-600">Tutar</div>
                    <div className="text-base font-semibold">
                      {fmtMajor(o.amountTotal ?? 0, currency)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-600">Tarih</div>
                    <div className="text-sm">{when}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-600">Kalem Sayısı</div>
                    <div className="text-sm">{count}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-600">Ödeme</div>
                    <div className="text-sm">Kredi Kartı</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Link
                    href={`/user/orders/${o.id}`}
                    className="inline-flex rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                  >
                    Detayı Gör
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
