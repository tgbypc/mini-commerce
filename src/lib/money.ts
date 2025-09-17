export function fmtCurrency(amount: number | null | undefined, currency = 'USD', locale?: string) {
  const val = typeof amount === 'number' ? amount : 0
  const cur = (currency || 'USD').toUpperCase()
  // Choose locale by currency if not passed
  const loc =
    locale ||
    (cur === 'USD' ? 'en-US' : cur === 'NOK' ? 'nb-NO' : cur === 'TRY' ? 'tr-TR' : 'en-US')
  try {
    return new Intl.NumberFormat(loc, { style: 'currency', currency: cur }).format(val)
  } catch {
    return `${cur} ${val.toFixed(2)}`
  }
}

