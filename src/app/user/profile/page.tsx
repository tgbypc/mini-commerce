'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { Timestamp, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'react-hot-toast'

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

type UserAddress = {
  id: string
  name?: string
  phone?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  isDefault?: boolean
}

type AddressForm = {
  id: string
  name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  country: string
  isDefault: boolean
}

function parseAddressList(value: unknown): UserAddress[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const obj = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
      const id = String(obj.id ?? '')
      if (!id) return null
      const address: UserAddress = { id }
      if (typeof obj.name === 'string') address.name = obj.name
      if (typeof obj.phone === 'string') address.phone = obj.phone
      if (typeof obj.line1 === 'string') address.line1 = obj.line1
      if (typeof obj.line2 === 'string') address.line2 = obj.line2
      if (typeof obj.city === 'string') address.city = obj.city
      if (typeof obj.state === 'string') address.state = obj.state
      if (typeof obj.zip === 'string') address.zip = obj.zip
      if (typeof obj.country === 'string') address.country = obj.country
      if ('isDefault' in obj) address.isDefault = Boolean(obj.isDefault)
      return address
    })
    .filter((addr): addr is UserAddress => addr !== null)
}

function createEmptyAddressForm(): AddressForm {
  return {
    id: '',
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
    country: 'NO',
    isDefault: false,
  }
}

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
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [addrForm, setAddrForm] = useState<AddressForm>(createEmptyAddressForm())

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
        const data = (await res.json()) as unknown
        const items = data && typeof data === 'object' ? (data as { items?: unknown }).items : []
        setAddresses(parseAddressList(items))
      } catch {}
    })()
  }, [user, authLoading])

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const payload = {
      id: addrForm.id.trim(),
      name: addrForm.name.trim(),
      phone: addrForm.phone.trim(),
      line1: addrForm.line1.trim(),
      line2: addrForm.line2.trim(),
      city: addrForm.city.trim(),
      state: addrForm.state.trim(),
      zip: addrForm.zip.trim(),
      country: (addrForm.country || 'NO').trim().toUpperCase(),
      isDefault: addrForm.isDefault,
    }

    if (!payload.name || !payload.line1 || !payload.city || !payload.zip) {
      toast.error('Please complete all required fields')
      return
    }

    setAddrSaving(true)
    try {
      const token = await user.getIdToken().catch(() => undefined)
      const res = await fetch('/api/user/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          ...payload,
          id: payload.id || undefined,
          phone: payload.phone || undefined,
          line2: payload.line2 || undefined,
          state: payload.state || undefined,
        }),
      })
      const data = (await res.json()) as unknown
      if (!res.ok) {
        const message =
          data &&
          typeof data === 'object' &&
          typeof (data as { error?: unknown }).error === 'string'
            ? String((data as { error?: unknown }).error)
            : 'Failed'
        throw new Error(message)
      }
      const listResponse = await fetch('/api/user/addresses', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const listData = (await listResponse.json()) as unknown
      const items = listData && typeof listData === 'object' ? (listData as { items?: unknown }).items : []
      setAddresses(parseAddressList(items))
      toast.success(payload.id ? 'Address updated' : 'Address added')
      setAddrForm(createEmptyAddressForm())
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Address could not be saved'
      toast.error(message)
    } finally {
      setAddrSaving(false)
    }
  }

  async function deleteAddress(id: string) {
    if (!user) return
    const token = await user.getIdToken().catch(() => undefined)
    await fetch(`/api/user/addresses/${encodeURIComponent(id)}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const listResponse = await fetch('/api/user/addresses', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const listData = (await listResponse.json()) as unknown
    const items = listData && typeof listData === 'object' ? (listData as { items?: unknown }).items : []
    setAddresses(parseAddressList(items))
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
  const totalOrders = orders.length

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

      {/* Account info */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Account Information</h2>
        <div className="mt-3 flex items-center gap-4">
          <div className="size-12 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-semibold">
            {(user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div className="text-sm">
            <div className="font-medium">{user?.displayName || 'User'}</div>
            <div className="text-zinc-600">{profile.email}</div>
            <div className="text-zinc-600">ID: {profile.uid}</div>
            <div className="text-zinc-600">Total Orders: {totalOrders}</div>
            {user?.emailVerified ? (
              <span className="mt-1 inline-flex rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">Email verified</span>
            ) : (
              <span className="mt-1 inline-flex rounded bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700 border">Email not verified</span>
            )}
          </div>
        </div>
        
        {/* Editable profile fields */}
        <form onSubmit={saveProfile} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-zinc-700">Full Name</label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, displayName: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-700">Phone</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, phone: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Phone number"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-700">Address</label>
            <textarea
              value={profileForm.address}
              onChange={(e) =>
                setProfileForm((p) => ({ ...p, address: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              rows={3}
              placeholder="Address details"
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

      {/* Favorites (teaser) */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Favorites</h2>
          <Link href="/favorites" className="text-sm font-medium underline">View All</Link>
        </div>
        <p className="mt-2 text-sm text-zinc-600">Manage your favorite products for quick access.</p>
      </div>

      {/* Addresses */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Addresses</h2>
        {addresses.length === 0 ? (
          <p className="text-sm text-zinc-600">You have no saved addresses.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {addresses.map((a) => (
              <li key={a.id} className="py-2 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{a.name} {a.isDefault ? <span className="ml-2 rounded bg-zinc-100 px-1.5 text-[11px]">Default</span> : null}</div>
                  <div className="text-zinc-600">{a.line1} {a.line2}</div>
                  <div className="text-zinc-600">{a.zip} {a.city} {a.state}</div>
                  <div className="text-zinc-600">{a.country}</div>
                  {a.phone && <div className="text-zinc-600">{a.phone}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => setAddrForm({ id: a.id, name: a.name || '', phone: a.phone || '', line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', zip: a.zip || '', country: a.country || 'NO', isDefault: !!a.isDefault })}>Edit</button>
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => deleteAddress(a.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={saveAddress} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="rounded border px-3 py-2 text-sm" placeholder="Full Name" value={addrForm.name} onChange={(e) => setAddrForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="Phone" value={addrForm.phone} onChange={(e) => setAddrForm((p) => ({ ...p, phone: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm sm:col-span-2" placeholder="Address Line 1" value={addrForm.line1} onChange={(e) => setAddrForm((p) => ({ ...p, line1: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm sm:col-span-2" placeholder="Address Line 2 (optional)" value={addrForm.line2} onChange={(e) => setAddrForm((p) => ({ ...p, line2: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="City" value={addrForm.city} onChange={(e) => setAddrForm((p) => ({ ...p, city: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="State/Region (optional)" value={addrForm.state} onChange={(e) => setAddrForm((p) => ({ ...p, state: e.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="Postal Code" value={addrForm.zip} onChange={(e) => setAddrForm((p) => ({ ...p, zip: e.target.value }))} />
          <select className="rounded border px-3 py-2 text-sm" value={addrForm.country} onChange={(e) => setAddrForm((p) => ({ ...p, country: e.target.value }))}>
            <option value="NO">Norway</option>
            <option value="US">United States</option>
            <option value="TR">Turkey</option>
          </select>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={addrForm.isDefault} onChange={(e) => setAddrForm((p) => ({ ...p, isDefault: e.target.checked }))} /> Default address
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" disabled={addrSaving} className="rounded bg-black text-white px-3 py-2 text-sm">{addrSaving ? 'Saving…' : (addrForm.id ? 'Update' : 'Add')}</button>
            <button type="button" onClick={() => setAddrForm({ id: '', name: '', phone: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'NO', isDefault: false })} className="rounded border px-3 py-2 text-sm">Clear</button>
          </div>
        </form>
      </div>
    </div>
  )
}
