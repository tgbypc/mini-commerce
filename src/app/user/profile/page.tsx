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
  const [verifySending, setVerifySending] = useState(false)
  const [verifyCooldown, setVerifyCooldown] = useState(0)

  useEffect(() => {
    if (!verifyCooldown) return
    const timer = setInterval(() => {
      setVerifyCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [verifyCooldown])

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
      <div className="min-h-[60vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-zinc-200 bg-white/90 px-6 py-10 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-[#0d141c]">{t('profile.title')}</h1>
          <p className="mt-2 text-sm text-zinc-600">{t('profile.needLogin')}</p>
          <Link
            href="/user/login"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0d141c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2a37]"
          >
            {t('nav.login')}
          </Link>
        </div>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] bg-[#f6f7fb] px-4 py-10">
        <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="h-72 rounded-3xl border border-zinc-200 bg-white/80 shadow animate-pulse" />
          <div className="h-72 rounded-3xl border border-zinc-200 bg-white/75 shadow animate-pulse" />
        </div>
      </div>
    )
  }

  const profile = {
    email: user?.email ?? '',
    uid: user?.uid ?? '',
  }
  const totalOrders = orders.length

  async function handleResendVerification() {
    if (!user) return
    if (user.emailVerified) {
      toast.success('Email already verified.')
      return
    }
    if (verifyCooldown > 0 || verifySending) return
    setVerifySending(true)
    try {
      const token = await user.getIdToken().catch(() => null)
      if (!token) throw new Error('auth-token-missing')
      const res = await fetch('/api/auth/email-verification/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        const message = data.error || 'Could not send verification email. Please try again later.'
        throw new Error(message)
      }
      toast.success('Verification email sent. Please check your inbox.')
      setVerifyCooldown(60)
    } catch (err) {
      console.error('Verification email resend failed', err)
      if (err instanceof Error && err.message && err.message !== 'auth-token-missing') {
        toast.error(err.message)
      } else {
        toast.error('Could not send verification email. Please try again later.')
      }
    } finally {
      setVerifySending(false)
    }
  }

  return (
    <div className="bg-[#f6f7fb] px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)] md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-[#f4f4f5] text-base font-semibold text-[#0d141c]">
              {(user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="space-y-1 text-sm text-[#0d141c]">
              <div className="text-lg font-semibold">{user?.displayName || 'User'}</div>
              <div className="text-zinc-600">{profile.email}</div>
              <div className="text-zinc-600">ID: {profile.uid}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm text-zinc-600 md:text-right">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-zinc-200 bg-[#f4f4f5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-600 md:self-end">
              {totalOrders} orders
            </div>
            {user?.emailVerified ? (
              <span className="inline-flex items-center self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 md:self-end">
                Email verified
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f4f4f5] px-3 py-1 text-xs font-semibold text-zinc-600">
                  Email not verified
                </span>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={verifySending || verifyCooldown > 0}
                  className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-[#0d141c] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {verifySending
                    ? 'Sending…'
                    : verifyCooldown > 0
                    ? `Resend (${verifyCooldown}s)`
                    : 'Resend verification'}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center justify-center self-start rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-white md:self-end"
            >
              {t('profile.logout')}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <form
            onSubmit={saveProfile}
            className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
          >
            <div>
              <h2 className="text-lg font-semibold text-[#0d141c]">Account preferences</h2>
              <p className="text-sm text-zinc-600">Update your contact details so we can reach you when needed.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
                Full name
                <input
                  type="text"
                  value={profileForm.displayName}
                  onChange={(e) => setProfileForm((p) => ({ ...p, displayName: e.target.value }))}
                  className="h-11 rounded-2xl border border-zinc-200 bg-[#f4f4f5] px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder="Full name"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font_medium text-zinc-600">
                Phone
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                  className="h-11 rounded-2xl border border-zinc-200 bg-[#f4f4f5] px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder="Phone number"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
              Address
              <textarea
                value={profileForm.address}
                onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))}
                className="min-h-[96px] rounded-2xl border border-zinc-200 bg-[#f4f4f5] px-4 py-3 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                placeholder="Address details"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-full bg-[#0d141c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2a37] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? t('profile.saving') : t('profile.save')}
              </button>
            </div>
          </form>

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#0d141c]">Favorites</h2>
                  <p className="text-sm text-zinc-600">Quickly jump to the products you love.</p>
                </div>
                <Link href="/favorites" className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium text-[#0d141c] transition hover:bg-white">
                  View all
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#0d141c]">Delivery addresses</h2>
                  <p className="text-sm text-zinc-600">Save where we should ship your future orders.</p>
                </div>
                {addrForm.id && (
                  <button
                    type="button"
                    onClick={() => setAddrForm(createEmptyAddressForm())}
                    className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-[#0d141c] transition hover:bg-white"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              {addresses.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">You have no saved addresses yet.</p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {addresses.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-[#0d141c]">
                          <span className="font-semibold">{a.name || 'Unnamed address'}</span>
                          {a.isDefault ? (
                            <span className="inline-flex items-center rounded-full border border-[#0d141c]/20 bg-[#0d141c]/5 px-2 py-0.5 text-[11px] font-semibold text-[#0d141c]">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <div>{[a.line1, a.line2].filter(Boolean).join(' ')}</div>
                        <div>{[a.zip, a.city, a.state].filter(Boolean).join(' ')}</div>
                        <div>{a.country}</div>
                        {a.phone ? <div>{a.phone}</div> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setAddrForm({
                              id: a.id,
                              name: a.name || '',
                              phone: a.phone || '',
                              line1: a.line1 || '',
                              line2: a.line2 || '',
                              city: a.city || '',
                              state: a.state || '',
                              zip: a.zip || '',
                              country: a.country || 'NO',
                              isDefault: !!a.isDefault,
                            })
                          }
                          className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-[#0d141c] transition hover:bg-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAddress(a.id)}
                          className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={saveAddress}
                className="mt-6 grid gap-3 rounded-2xl border border-zinc-200 bg-[#f6f7fb] px-4 py-4 md:grid-cols-2"
              >
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder="Full name"
                  value={addrForm.name}
                  onChange={(e) => setAddrForm((p) => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder="Phone"
                  value={addrForm.phone}
                  onChange={(e) => setAddrForm((p) => ({ ...p, phone: e.target.value }))}
                />
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10 md:col-span-2"
                  placeholder="Address line 1"
                  value={addrForm.line1}
                  onChange={(e) => setAddrForm((p) => ({ ...p, line1: e.target.value }))}
                />
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10 md:col-span-2"
                  placeholder="Address line 2 (optional)"
                  value={addrForm.line2}
                  onChange={(e) => setAddrForm((p) => ({ ...p, line2: e.target.value }))}
                />
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder="City"
                  value={addrForm.city}
                  onChange={(e) => setAddrForm((p) => ({ ...p, city: e.target.value }))}
                />
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder="State / Region"
                  value={addrForm.state}
                  onChange={(e) => setAddrForm((p) => ({ ...p, state: e.target.value }))}
                />
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder="Postal code"
                  value={addrForm.zip}
                  onChange={(e) => setAddrForm((p) => ({ ...p, zip: e.target.value }))}
                />
                <select
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  value={addrForm.country}
                  onChange={(e) => setAddrForm((p) => ({ ...p, country: e.target.value }))}
                >
                  <option value="NO">Norway</option>
                  <option value="US">United States</option>
                  <option value="TR">Turkey</option>
                </select>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-600 md:col-span-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded border border-zinc-300"
                    checked={addrForm.isDefault}
                    onChange={(e) => setAddrForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  />
                  Set as default address
                </label>
                <div className="flex justify-end gap-3 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => setAddrForm(createEmptyAddressForm())}
                    className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-white"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={addrSaving}
                    className="inline-flex items-center rounded-full bg-[#0d141c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2a37] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addrSaving ? 'Saving…' : addrForm.id ? 'Update address' : 'Save address'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
