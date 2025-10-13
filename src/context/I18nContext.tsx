'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import en from '@/i18n/en'
import nb from '@/i18n/nb'

type Locale = 'en' | 'nb'
type Messages = typeof en

const MESSAGES: Record<Locale, Messages> = { en, nb }
const STORAGE_KEY = 'locale'

function get(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (
      cur &&
      typeof cur === 'object' &&
      p in (cur as Record<string, unknown>)
    ) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

type I18nContextType = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: keyof Messages | string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
      if (saved === 'en' || saved === 'nb') setLocale(saved)
      else {
        const nav =
          typeof navigator !== 'undefined'
            ? navigator.language.toLowerCase()
            : ''
        if (nav.startsWith('nb') || nav.startsWith('no')) setLocale('nb')
        else setLocale('en')
      }
    } catch {
      // default en
    }
  }, [])

  const value: I18nContextType = useMemo(() => {
    const messages = MESSAGES[locale]
    return {
      locale,
      setLocale: (l) => {
        setLocale(l)
        try {
          localStorage.setItem(STORAGE_KEY, l)
        } catch {}
      },
      t: (key: string) => get(messages, key) ?? key,
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
