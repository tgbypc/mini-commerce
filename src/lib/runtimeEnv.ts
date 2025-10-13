const DEV_ORIGIN = 'http://localhost:3000'

function normalizeUrl(url: string) {
  return url.startsWith('http') ? url : `https://${url}`
}

export function getBaseUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl?.length) return normalizeUrl(siteUrl)

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl?.length) return normalizeUrl(vercelUrl)

  return DEV_ORIGIN
}

export function getInternalFetchHeaders(): HeadersInit | undefined {
  const bypass = process.env.VERCEL_PROTECTION_BYPASS
  if (!bypass) return undefined
  return { 'x-vercel-protection-bypass': bypass }
}