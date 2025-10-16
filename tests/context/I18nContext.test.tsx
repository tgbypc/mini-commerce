import React, { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from '@/context/I18nContext'

function TestComponent() {
  const { locale, t, setLocale } = useI18n()
  useEffect(() => {
    ;(window as { __i18n?: ReturnType<typeof useI18n> }).__i18n = {
      locale,
      t,
      setLocale,
    }
  }, [locale, t, setLocale])
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t('nav.home')}</span>
      <button
        type="button"
        onClick={() => setLocale(locale === 'en' ? 'nb' : 'en')}
      >
        toggle
      </button>
    </div>
  )
}

function renderProvider() {
  return render(
    <I18nProvider>
      <TestComponent />
    </I18nProvider>
  )
}

describe('I18nContext', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'navigator', {
      value: { language: 'en-US' },
      configurable: true,
    })
    ;(window as { __i18n?: ReturnType<typeof useI18n> }).__i18n = undefined
  })

  it('uses stored locale from localStorage', async () => {
    localStorage.setItem('locale', 'nb')
    renderProvider()

    await waitFor(() =>
      expect(screen.getByTestId('locale').textContent).toBe('nb')
    )
    expect(screen.getByTestId('label').textContent).not.toBe('nav.home')
  })

  it('falls back to navigator language when storage missing', async () => {
    Object.defineProperty(window, 'navigator', {
      value: { language: 'nb-NO' },
      configurable: true,
    })
    renderProvider()

    await waitFor(() =>
      expect(screen.getByTestId('locale').textContent).toBe('nb')
    )
  })

  it('returns key when translation is missing', async () => {
    renderProvider()
    const ctx = await waitFor(() => {
      const value = (window as { __i18n?: ReturnType<typeof useI18n> })
        .__i18n
      if (!value) throw new Error('Missing i18n context')
      return value
    })
    expect(ctx.t('missing.translation.key')).toBe('missing.translation.key')
  })

  it('persists locale changes to storage', async () => {
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('locale').textContent).toBe('en')
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'toggle' }))

    await waitFor(() =>
      expect(screen.getByTestId('locale').textContent).toBe('nb')
    )
    expect(localStorage.getItem('locale')).toBe('nb')
  })
})
