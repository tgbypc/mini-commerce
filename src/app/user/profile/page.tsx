'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Timestamp,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
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
      const obj =
        entry && typeof entry === 'object'
          ? (entry as Record<string, unknown>)
          : {}
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

function getOrderDate(order: OrderDoc): Date | null {
  const value = order.createdAt
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  return null
}

function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return null
  const code = (currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat(
      typeof window !== 'undefined' ? navigator.language : 'en-US',
      {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 2,
      }
    ).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`.trim()
  }
}

function getItemsCount(order: OrderDoc): number {
  if (!Array.isArray(order.items)) return 0
  return order.items.reduce((total, item) => total + (item.quantity || 0), 0)
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
  const [addrForm, setAddrForm] = useState<AddressForm>(
    createEmptyAddressForm()
  )
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [verifySending, setVerifySending] = useState(false)
  const [verifyCooldown, setVerifyCooldown] = useState(0)

  const sortedAddresses = useMemo(
    () =>
      [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    [addresses]
  )
  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const aDate = getOrderDate(a)
        const bDate = getOrderDate(b)
        return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0)
      }),
    [orders]
  )
  const recentOrders = useMemo(() => sortedOrders.slice(0, 3), [sortedOrders])

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

  useEffect(() => {
    ;(async () => {
      try {
        if (authLoading || !user) return
        const token = await user.getIdToken().catch(() => undefined)
        const res = await fetch('/api/user/addresses', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const data = (await res.json()) as unknown
        const items =
          data && typeof data === 'object'
            ? (data as { items?: unknown }).items
            : []
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
      toast.error(t('profile.addresses.toast.required'))
      return
    }

    setAddrSaving(true)
    try {
      const token = await user.getIdToken().catch(() => undefined)
      const res = await fetch('/api/user/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
            : t('profile.addresses.toast.error')
        throw new Error(message)
      }
      const listResponse = await fetch('/api/user/addresses', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const listData = (await listResponse.json()) as unknown
      const items =
        listData && typeof listData === 'object'
          ? (listData as { items?: unknown }).items
          : []
      setAddresses(parseAddressList(items))
      toast.success(
        payload.id
          ? t('profile.addresses.toast.updated')
          : t('profile.addresses.toast.saved')
      )
      setAddrForm(createEmptyAddressForm())
      setShowAddressForm(false)
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t('profile.addresses.toast.error')
      toast.error(message)
    } finally {
      setAddrSaving(false)
    }
  }

  async function deleteAddress(id: string) {
    if (!user) return
    if (typeof window !== 'undefined') {
      const confirmDelete = window.confirm(
        t('profile.addresses.actions.confirmDelete')
      )
      if (!confirmDelete) return
    }
    const token = await user.getIdToken().catch(() => undefined)
    await fetch(`/api/user/addresses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const listResponse = await fetch('/api/user/addresses', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const listData = (await listResponse.json()) as unknown
    const items =
      listData && typeof listData === 'object'
        ? (listData as { items?: unknown }).items
        : []
    setAddresses(parseAddressList(items))
    if (addrForm.id === id) {
      setAddrForm(createEmptyAddressForm())
      setShowAddressForm(false)
    }
    toast.success(t('profile.addresses.toast.deleted'))
  }

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
    return () => {
      cancelled = true
    }
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

  const profile = {
    email: user?.email ?? '',
    uid: user?.uid ?? '',
  }
  const totalOrders = orders.length
  const heroName =
    user?.displayName?.trim() ||
    profileForm.displayName?.trim() ||
    t('profile.hero.fallbackName')
  const heroGreeting = t('profile.hero.greeting').replace('{name}', heroName)
  const heroSubtitle = t('profile.hero.subtitle')
  const ordersCountLabel = t('profile.hero.ordersCount').replace(
    '{count}',
    String(totalOrders)
  )
  const addressesCount = addresses.length
  const defaultAddress = sortedAddresses.find((addr) => addr.isDefault)
  const verificationLabel = user?.emailVerified
    ? t('profile.verification.verified')
    : t('profile.verification.notVerified')
  const resendLabel = verifySending
    ? t('profile.verification.sending')
    : verifyCooldown > 0
    ? t('profile.verification.resendCooldown').replace(
        '{seconds}',
        String(verifyCooldown)
      )
    : t('profile.verification.resend')
  const primaryButtonClass =
    'inline-flex items-center justify-center rounded-full bg-[var(--color-primary-dark)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]'
  const locale = typeof window !== 'undefined' ? navigator.language : 'en-US'
  const isLoading = loading || authLoading
  const initials = (user?.displayName || user?.email || 'U')
    .slice(0, 2)
    .toUpperCase()

  if (!user && !authLoading) {
    return (
      <div className="min-h-[60vh] bg-[#f6f7fb] px-4 py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 rounded-3xl border border-zinc-200 bg-white/90 px-8 py-14 text-center shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <h1 className="text-3xl font-semibold text-[#0d141c]">
            {t('profile.title')}
          </h1>
          <p className="text-sm text-zinc-600 md:text-base">
            {t('profile.needLogin')}
          </p>
          <Link
            href="/user/login"
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary-dark)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
          >
            {t('nav.login')}
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] bg-[#f6f7fb] px-4 py-12">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="h-48 rounded-3xl border border-zinc-200 bg-white/70 shadow animate-pulse" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="h-96 rounded-3xl border border-zinc-200 bg-white/70 shadow animate-pulse" />
            <div className="space-y-6">
              <div className="h-48 rounded-3xl border border-zinc-200 bg-white/65 shadow animate-pulse" />
              <div className="h-64 rounded-3xl border border-zinc-200 bg-white/60 shadow animate-pulse" />
            </div>
          </div>
          <div className="h-80 rounded-3xl border border-zinc-200 bg-white/65 shadow animate-pulse" />
        </div>
      </div>
    )
  }

  async function handleResendVerification() {
    if (!user) return
    if (user.emailVerified) {
      toast.success(t('profile.verification.alreadyVerified'))
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
        const message = data.error || t('profile.verification.error')
        throw new Error(message)
      }
      toast.success(t('profile.verification.success'))
      setVerifyCooldown(60)
    } catch (err) {
      console.error('Verification email resend failed', err)
      if (
        err instanceof Error &&
        err.message &&
        err.message !== 'auth-token-missing'
      ) {
        toast.error(err.message)
      } else {
        toast.error(t('profile.verification.error'))
      }
    } finally {
      setVerifySending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-10 md:py-12">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-7 shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-[var(--color-primary-dark)]/5 text-xl font-semibold text-[#0d141c]">
                {initials}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
                    {t('profile.title')}
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold text-[#0d141c] md:text-3xl">
                    {heroGreeting}
                  </h1>
                </div>
                <p className="text-sm text-zinc-600 md:text-base">
                  {heroSubtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  <span className="rounded-full bg-[#f6f7fb] px-3 py-1 text-[#0d141c]">
                    {ordersCountLabel}
                  </span>
                  {profile.email ? (
                    <span className="rounded-full bg-[#f6f7fb] px-3 py-1 text-[#0d141c]">
                      {profile.email}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-[#f6f7fb] px-3 py-1 text-[#0d141c]">
                    ID: {profile.uid}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-md">
              <div className="rounded-2xl border border-zinc-200 bg-[#f6f7fb] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  {t('profile.ordersPreview.heading')}
                </p>
                <p className="mt-2 text-lg font-semibold text-[#0d141c]">
                  {totalOrders}
                </p>
                <Link
                  href="/user/orders"
                  className="mt-3 inline-flex text-xs font-semibold text-[#0d141c] underline-offset-4 hover:underline"
                >
                  {t('profile.ordersPreview.viewAll')}
                </Link>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-[#f6f7fb] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  {t('profile.addresses.heading')}
                </p>
                <p className="mt-2 text-lg font-semibold text-[#0d141c]">
                  {addressesCount}
                </p>
                <p className="text-xs text-zinc-500">
                  {defaultAddress
                    ? defaultAddress.name ||
                      defaultAddress.line1 ||
                      defaultAddress.city ||
                      t('profile.addresses.defaultBadge')
                    : t('profile.addresses.description')}
                </p>
              </div>
              <div className="sm:col-span-2 rounded-2xl border border-[#0d141c]/15 bg-[var(--color-primary-dark)] px-4 py-4 text-white shadow">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  Account status
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {verificationLabel}
                </div>
                {!user?.emailVerified ? (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={verifySending || verifyCooldown > 0}
                    className="mt-3 inline-flex items-center justify-center rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {resendLabel}
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-white/70">
                    {t('profile.verification.success')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0d141c] transition hover:bg-white/90"
                >
                  {t('profile.logout')}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <form
            onSubmit={saveProfile}
            className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:px-8"
          >
            <div>
              <h2 className="text-lg font-semibold text-[#0d141c]">
                {t('profile.accountCard.heading')}
              </h2>
              <p className="text-sm text-zinc-600">
                {t('profile.accountCard.description')}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.accountCard.nameLabel')}
                <input
                  type="text"
                  value={profileForm.displayName}
                  onChange={(e) =>
                    setProfileForm((p) => ({
                      ...p,
                      displayName: e.target.value,
                    }))
                  }
                  className="h-11 rounded-2xl border border-zinc-200 bg-[#f4f4f5] px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder={t('profile.accountCard.nameLabel')}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.accountCard.phoneLabel')}
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  className="h-11 rounded-2xl border border-zinc-200 bg-[#f4f4f5] px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder={t('profile.accountCard.phoneLabel')}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
              {t('profile.accountCard.notesLabel')}
              <textarea
                value={profileForm.address}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, address: e.target.value }))
                }
                className="min-h-[112px] rounded-2xl border border-zinc-200 bg-[#f4f4f5] px-4 py-3 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                placeholder={t('profile.accountCard.notesPlaceholder')}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {saving ? t('profile.saving') : t('profile.accountCard.save')}
              </button>
            </div>
          </form>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:px-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#0d141c]">
                    {t('profile.favorites.heading')}
                  </h2>
                  <p className="text-sm text-zinc-600">
                    {t('profile.favorites.description')}
                  </p>
                </div>
                <Link
                  href="/favorites"
                  className={primaryButtonClass}
                >
                  {t('profile.favorites.view')}
                </Link>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/user/orders"
                  className={`${primaryButtonClass} gap-2`}
                >
                  {t('nav.orders')}
                </Link>
                <Link
                  href="/cart"
                  className={`${primaryButtonClass} gap-2`}
                >
                  {t('nav.cart')}
                </Link>
                <Link
                  href="/store"
                  className={`${primaryButtonClass} gap-2 sm:col-span-2`}
                >
                  {t('nav.store')}
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:px-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#0d141c]">
                    {t('profile.ordersPreview.heading')}
                  </h2>
                  <p className="text-sm text-zinc-600">
                    {t('profile.hero.subtitle')}
                  </p>
                </div>
                <Link
                  href="/user/orders"
                  className="inline-flex items-center text-sm font-semibold text-[#0d141c] underline-offset-4 hover:underline"
                >
                  {t('profile.ordersPreview.viewAll')}
                </Link>
              </div>
              {recentOrders.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">
                  {t('profile.ordersPreview.empty')}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentOrders.map((order) => {
                    const orderDate = getOrderDate(order)
                    const formattedDate = orderDate
                      ? orderDate.toLocaleDateString(locale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '--'
                    const amountLabel =
                      formatCurrency(
                        order.amountTotal ?? null,
                        order.currency ?? null
                      ) || '--'
                    const itemsLabel = t('orders.orderCard.items').replace(
                      '{count}',
                      String(getItemsCount(order))
                    )
                    return (
                      <Link
                        key={order.id}
                        href={`/user/orders/${order.id}`}
                        className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-[#f6f7fb] px-4 py-3 text-sm text-[#0d141c] transition hover:border-[#0d141c]/40 hover:bg-white"
                      >
                        <div>
                          <p className="font-semibold">
                            #{order.id.slice(0, 10).toUpperCase()}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {t('orders.orderCard.placedOn').replace(
                              '{date}',
                              formattedDate
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                            {t('orders.orderCard.total')}
                          </p>
                          <p className="font-semibold">{amountLabel}</p>
                          <p className="text-xs text-zinc-500">{itemsLabel}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#0d141c]">
                {t('profile.addresses.heading')}
              </h2>
              <p className="text-sm text-zinc-600">
                {t('profile.addresses.description')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (showAddressForm) {
                  setAddrForm(createEmptyAddressForm())
                }
                setShowAddressForm((prev) => !prev)
              }}
              className={primaryButtonClass}
            >
              {showAddressForm || addrForm.id
                ? t('profile.addresses.form.cancel')
                : t('profile.addresses.add')}
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {sortedAddresses.length === 0 ? (
              <p className="text-sm text-zinc-600">
                {t('profile.addresses.empty')}
              </p>
            ) : (
              sortedAddresses.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-[#f6f7fb] px-4 py-4 text-sm text-zinc-600 shadow-sm sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[#0d141c]">
                      <span className="font-semibold">
                        {a.name || t('profile.addresses.form.name')}
                      </span>
                      {a.isDefault ? (
                        <span className="inline-flex items-center rounded-full border border-[#0d141c]/20 bg-[var(--color-primary-dark)]/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#0d141c]">
                          {t('profile.addresses.defaultBadge')}
                        </span>
                      ) : null}
                    </div>
                    {a.line1 ? <div>{a.line1}</div> : null}
                    {a.line2 ? <div>{a.line2}</div> : null}
                    <div>
                      {[a.zip, a.city, a.state].filter(Boolean).join(' ')}
                    </div>
                    <div>{a.country}</div>
                    {a.phone ? <div>{a.phone}</div> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
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
                    setShowAddressForm(true)
                  }}
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-400/25 dark:hover:text-white"
                >
                  {t('profile.addresses.actions.edit')}
                </button>
                    <button
                      type="button"
                      onClick={() => deleteAddress(a.id)}
                      className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      {t('profile.addresses.actions.delete')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {(showAddressForm || addrForm.id) && (
            <form
              onSubmit={saveAddress}
              className="mt-6 grid gap-3 rounded-2xl border border-dashed border-[#0d141c]/25 bg-white px-4 py-4 md:grid-cols-2"
            >
              <h3 className="md:col-span-2 text-base font-semibold text-[#0d141c]">
                {addrForm.id
                  ? t('profile.addresses.form.headingEdit')
                  : t('profile.addresses.form.headingAdd')}
              </h3>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.addresses.form.name')}
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder={t('profile.addresses.form.name')}
                  value={addrForm.name}
                  onChange={(e) =>
                    setAddrForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.addresses.form.phone')}
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder={t('profile.addresses.form.phone')}
                  value={addrForm.phone}
                  onChange={(e) =>
                    setAddrForm((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.addresses.form.line1')}
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder={t('profile.addresses.form.line1')}
                  value={addrForm.line1}
                  onChange={(e) =>
                    setAddrForm((p) => ({ ...p, line1: e.target.value }))
                  }
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.addresses.form.line2')}
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder={t('profile.addresses.form.line2')}
                  value={addrForm.line2}
                  onChange={(e) =>
                    setAddrForm((p) => ({ ...p, line2: e.target.value }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.addresses.form.city')}
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder={t('profile.addresses.form.city')}
                  value={addrForm.city}
                  onChange={(e) =>
                    setAddrForm((p) => ({ ...p, city: e.target.value }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.addresses.form.state')}
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder={t('profile.addresses.form.state')}
                  value={addrForm.state}
                  onChange={(e) =>
                    setAddrForm((p) => ({ ...p, state: e.target.value }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.addresses.form.zip')}
                <input
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  placeholder={t('profile.addresses.form.zip')}
                  value={addrForm.zip}
                  onChange={(e) =>
                    setAddrForm((p) => ({ ...p, zip: e.target.value }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
                {t('profile.addresses.form.country')}
                <select
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
                  value={addrForm.country}
                  onChange={(e) =>
                    setAddrForm((p) => ({ ...p, country: e.target.value }))
                  }
                >
                  <option value="NO">Norway</option>
                  <option value="US">United States</option>
                  <option value="TR">Turkey</option>
                </select>
              </label>
              <label className="md:col-span-2 flex items-center gap-2 text-sm font-medium text-zinc-600">
                <input
                  type="checkbox"
                  className="size-4 rounded border border-zinc-300"
                  checked={addrForm.isDefault}
                  onChange={(e) =>
                    setAddrForm((p) => ({ ...p, isDefault: e.target.checked }))
                  }
                />
                {t('profile.addresses.form.setDefault')}
              </label>
              <div className="md:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAddrForm(createEmptyAddressForm())
                    setShowAddressForm(false)
                  }}
                  className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-[#0d141c] transition hover:bg-[#f6f7fb]"
                >
                  {t('profile.addresses.form.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={addrSaving}
                  className="inline-flex items-center rounded-full bg-[var(--color-primary-dark)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addrSaving
                    ? t('profile.saving')
                    : addrForm.id
                    ? t('profile.addresses.form.update')
                    : t('profile.addresses.form.save')}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
