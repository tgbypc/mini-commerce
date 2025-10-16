import { afterEach, describe, expect, it } from 'vitest'
import { getBaseUrl, getInternalFetchHeaders } from '@/lib/runtimeEnv'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('getBaseUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL when available', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://prod.example.com'
    process.env.VERCEL_URL = 'staging.example.dev'
    expect(getBaseUrl()).toBe('https://prod.example.com')
  })

  it('falls back to VERCEL_URL when public site url is missing', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    process.env.VERCEL_URL = 'staging.example.dev'
    expect(getBaseUrl()).toBe('https://staging.example.dev')
  })

  it('returns localhost when no env vars are defined', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.VERCEL_URL
    expect(getBaseUrl()).toBe('http://localhost:3000')
  })
})

describe('getInternalFetchHeaders', () => {
  it('returns undefined when bypass token is missing', () => {
    delete process.env.VERCEL_PROTECTION_BYPASS
    expect(getInternalFetchHeaders()).toBeUndefined()
  })

  it('returns headers when bypass token exists', () => {
    process.env.VERCEL_PROTECTION_BYPASS = 'token'
    expect(getInternalFetchHeaders()).toEqual({
      'x-vercel-protection-bypass': 'token',
    })
  })
})
