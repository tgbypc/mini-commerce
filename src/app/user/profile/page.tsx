'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { Timestamp, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { fmtCurrency } from '@/lib/money'
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
  const { t } = useI18n()
  const { user, loading: authLoading, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderDoc[]>([])
  const [saving, setSaving] = useState(false)
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    phone: '',
    address: '',
  })
  const [addrSaving, setAddrSaving] = useState(false)
  const [addresses, setAddresses] = useState<any[]>([])
  const [addrForm, setAddrForm] = useState({ id: '', name: '', phone: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'NO', isDefault: false })

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

  // Load addresses
  useEffect(() => {
    ;(async () => {
      try {
        if (authLoading || !user) return
        const token = await user.getIdToken().catch(() => undefined)
        const res = await fetch('/api/user/addresses', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        const data = await res.json()
        setAddresses(Array.isArray(data.items) ? data.items : [])
      } catch {}
    })()
  }, [user, authLoading])

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setAddrSaving(true)
    try {
      const token = await user.getIdToken().catch(() => undefined)
      const res = await fetch('/api/user/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(addrForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      const list = await fetch('/api/user/addresses', { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.json())
      setAddresses(Array.isArray(list.items) ? list.items : [])
      setAddrForm({ id: '', name: '', phone: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'NO', isDefault: false })
    } finally {
      setAddrSaving(false)
    }
  }

  async function deleteAddress(id: string) {
    if (!user) return
    const token = await user.getIdToken().catch(() => undefined)
    await fetch(`/api/user/addresses/${encodeURIComponent(id)}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const list = await fetch('/api/user/addresses', { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.json())
    setAddresses(Array.isArray(list.items) ? list.items : [])
  }

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
        <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
        <p className="mt-2 text-zinc-600">{t('profile.needLogin')}</p>
        <Link href="/user/login" className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">{t('nav.login')}</Link>
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
        <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
        >
          {t('profile.logout')}
        </button>
      </div>

      {/* Hesap bilgileri */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Hesap Bilgileri</h2>
        <div className="mt-3 flex items-center gap-4">
          <div className="size-12 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-semibold">
            {(user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div className="text-sm">
            <div className="font-medium">{user?.displayName || 'Kullanıcı'}</div>
            <div className="text-zinc-600">{profile.email}</div>
            <div className="text-zinc-600">ID: {profile.uid}</div>
            {user?.emailVerified ? (
              <span className="mt-1 inline-flex rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">Email doğrulandı</span>
            ) : (
              <span className="mt-1 inline-flex rounded bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700 border">Email doğrulanmadı</span>
            )}
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
              {saving ? t('profile.saving') : t('profile.save')}
            </button>
          </div>
        </form>
      </div>

      {/* Favoriler (kısa) */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Favoriler</h2>
          <Link href="/favorites" className="text-sm font-medium underline">Tümünü Gör</Link>
        </div>
        <p className="mt-2 text-sm text-zinc-600">Favori ürünlerinizi yönetin ve hızlı erişin.</p>
      </div>

      {/* Adresler */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Adresler</h2>
        {addresses.length === 0 ? (
          <p className="text-sm text-zinc-600">Kayıtlı adresiniz yok.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {addresses.map((a) => (
              <li key={a.id} className="py-2 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{a.name} {a.isDefault ? <span className="ml-2 rounded bg-zinc-100 px-1.5 text-[11px]">Varsayılan</span> : null}</div>
                  <div className="text-zinc-600">{a.line1} {a.line2}</div>
                  <div className="text-zinc-600">{a.zip} {a.city} {a.state}</div>
                  <div className="text-zinc-600">{a.country}</div>
                  {a.phone && <div className="text-zinc-600">{a.phone}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => setAddrForm({ id: a.id, name: a.name || '', phone: a.phone || '', line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', zip: a.zip || '', country: a.country || 'NO', isDefault: !!a.isDefault })}>Düzenle</button>
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => deleteAddress(a.id)}>Sil</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={saveAddress} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="rounded border px-3 py-2 text-sm" placeholder="Ad Soyad" value={addrForm.name} onChange={(e) => setAddrForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="Telefon" value={addrForm.phone} onChange={(e) => setAddrForm((p) => ({ ...p, phone: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm sm:col-span-2" placeholder="Adres Satırı 1" value={addrForm.line1} onChange={(e) => setAddrForm((p) => ({ ...p, line1: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm sm:col-span-2" placeholder="Adres Satırı 2 (opsiyonel)" value={addrForm.line2} onChange={(e) => setAddrForm((p) => ({ ...p, line2: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="Şehir" value={addrForm.city} onChange={(e) => setAddrForm((p) => ({ ...p, city: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="Eyalet/İl (opsiyonel)" value={addrForm.state} onChange={(e) => setAddrForm((p) => ({ ...p, state: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="Posta Kodu" value={addrForm.zip} onChange={(e) => setAddrForm((p) => ({ ...p, zip: e.target.value }))} />
          <select className="rounded border px-3 py-2 text-sm" value={addrForm.country} onChange={(e) => setAddrForm((p) => ({ ...p, country: e.target.value }))}>
            <option value="NO">Norway</option>
            <option value="US">United States</option>
            <option value="TR">Türkiye</option>
          </select>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={addrForm.isDefault} onChange={(e) => setAddrForm((p) => ({ ...p, isDefault: e.target.checked }))} /> Varsayılan adres
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" disabled={addrSaving} className="rounded bg-black text-white px-3 py-2 text-sm">{addrSaving ? 'Kaydediliyor…' : (addrForm.id ? 'Güncelle' : 'Ekle')}</button>
            <button type="button" onClick={() => setAddrForm({ id: '', name: '', phone: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'NO', isDefault: false })} className="rounded border px-3 py-2 text-sm">Temizle</button>
          </div>
        </form>
      </div>
    </div>
  )
}
