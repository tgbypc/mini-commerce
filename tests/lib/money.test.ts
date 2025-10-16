import { describe, expect, it } from 'vitest'
import { fmtCurrency } from '@/lib/money'

describe('fmtCurrency', () => {
  it('formats USD amounts by default', () => {
    expect(fmtCurrency(1234.56)).toBe('$1,234.56')
  })

  it('switches locale when TRY currency is provided', () => {
    expect(fmtCurrency(199.99, 'TRY')).toBe('₺199,99')
  })

  it('falls back to string output when Intl throws', () => {
    const actual = fmtCurrency(42, 'INVALID')
    expect(actual).toBe('INVALID 42.00')
  })
})
