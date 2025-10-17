import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/contact/route'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'

const baseTimestamp = FieldValue.serverTimestamp()

let mockTimestamp: ReturnType<typeof FieldValue.serverTimestamp>
let restoreServerTimestamp: (() => void) | undefined

describe('/api/contact POST', () => {
  beforeEach(() => {
    vi.mocked(adminDb.collection).mockClear()
    mockTimestamp = baseTimestamp
    const spy = vi.spyOn(FieldValue, 'serverTimestamp').mockReturnValue(
      mockTimestamp
    )
    restoreServerTimestamp = () => spy.mockRestore()
  })

  afterEach(() => {
    restoreServerTimestamp?.()
  })

  it('stores trimmed payload and returns ok', async () => {
    const body = {
      name: '  Ada Lovelace  ',
      email: '  ada@example.com ',
      topic: 'order',
      message: '  I need help with my order.  ',
    }

    const response = await POST(
      new Request('https://shop.example/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ ok: true })

    expect(adminDb.collection).toHaveBeenCalledWith('contactMessages')
    const collectionResult = vi.mocked(adminDb.collection).mock.results[0]
    const collectionInstance = collectionResult.value as {
      add: ReturnType<typeof vi.fn>
    }
    expect(collectionInstance.add).toHaveBeenCalledWith({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      topic: 'order',
      message: 'I need help with my order.',
      emailLc: 'ada@example.com',
      status: 'new',
      createdAt: mockTimestamp,
    })
  })

  it('returns 400 with validation error details', async () => {
    const response = await POST(
      new Request('https://shop.example/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'A',
          email: 'not-valid',
          topic: 'general',
          message: 'short',
        }),
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid form data')
    expect(adminDb.collection).not.toHaveBeenCalled()
  })

  it('returns 500 for invalid JSON payload', async () => {
    const response = await POST(
      new Request('https://shop.example/api/contact', {
        method: 'POST',
        body: 'invalid-json',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Invalid JSON payload')
  })
})
