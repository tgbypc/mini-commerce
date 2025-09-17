export type LocaleCode = 'en' | 'nb' | 'tr'

export function pickI18nString(
  data: Record<string, unknown>,
  baseKey: string,
  locale: string
): string {
  const norm = (s: string) => s.trim().toLowerCase()
  const loc = norm(locale)

  // 1) Flat keys like title_en, description_nb
  const flatKey = `${baseKey}_${loc}`
  const flat = data[flatKey]
  if (typeof flat === 'string' && flat.trim().length > 0) return flat

  // 2) Nested object: title: { en: '...', nb: '...', tr: '...' }
  const nested = data[baseKey]
  if (
    nested &&
    typeof nested === 'object' &&
    nested !== null &&
    typeof (nested as Record<string, unknown>)[loc] === 'string'
  ) {
    const val = (nested as Record<string, unknown>)[loc] as string
    if (val.trim().length > 0) return val
  }

  // 3) Fallback to baseKey if it's a string
  const base = data[baseKey]
  if (typeof base === 'string') return base

  return ''
}

