import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import ContactContent from '@/components/contact/ContactContent'
import { I18nProvider } from '@/context/I18nContext'
import { server } from '../mocks/server'

describe('ContactContent', () => {
  it('submits the form successfully and resets fields', async () => {
    type ContactPayload = {
      name: string
      email: string
      topic: string
      message: string
    }
    let requestPayload: ContactPayload | null = null
    server.use(
      http.post('/api/contact', async ({ request }) => {
        requestPayload = (await request.json()) as ContactPayload
        expect(request.headers.get('content-type')).toBe(
          'application/json'
        )
        return HttpResponse.json({ ok: true })
      })
    )

    const user = userEvent.setup()
    render(
      <I18nProvider>
        <ContactContent />
      </I18nProvider>
    )

    await user.type(
      screen.getByLabelText(/Full name/i),
      '  Alice Example  '
    )
    await user.type(
      screen.getByLabelText(/Email address/i),
      ' alice@example.com '
    )
    await user.selectOptions(
      screen.getByLabelText(/Topic/i),
      'returns'
    )
    await user.type(
      screen.getByLabelText(/How can we help\?/i),
      '  I would like to return a recent order.  '
    )

    await user.click(screen.getByRole('button', { name: /Send message/i }))

    const { toast } = await import('react-hot-toast')

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled()
    })
    expect(requestPayload).toEqual({
      name: 'Alice Example',
      email: 'alice@example.com',
      topic: 'returns',
      message: 'I would like to return a recent order.',
    })

    expect(
      screen.getByLabelText(/Full name/i)
    ).toHaveValue('')
    expect(
      screen.getByLabelText(/Email address/i)
    ).toHaveValue('')
    expect(
      screen.getByLabelText(/Topic/i)
    ).toHaveValue('general')
    expect(
      screen.getByLabelText(/How can we help\?/i)
    ).toHaveValue('')
  })

  it('shows error toast when API returns failure', async () => {
    server.use(
      http.post('/api/contact', () =>
        HttpResponse.json({ error: 'fail' }, { status: 500 })
      )
    )

    const user = userEvent.setup()
    render(
      <I18nProvider>
        <ContactContent />
      </I18nProvider>
    )

    await user.type(
      screen.getByLabelText(/Full name/i),
      'Bob Example'
    )
    await user.type(
      screen.getByLabelText(/Email address/i),
      'bob@example.com'
    )
    await user.type(
      screen.getByLabelText(/How can we help\?/i),
      'Broken checkout flow reproduction'
    )

    await user.click(screen.getByRole('button', { name: /Send message/i }))
    const { toast } = await import('react-hot-toast')

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })

  it('disables the submit button while the request is in flight', async () => {
    let resolveRequest: (() => void) | undefined
    server.use(
      http.post('/api/contact', () => {
        return new Promise((resolve) => {
          resolveRequest = () =>
            resolve(HttpResponse.json({ ok: true }))
        })
      })
    )

    const user = userEvent.setup()
    render(
      <I18nProvider>
        <ContactContent />
      </I18nProvider>
    )

    await user.type(
      screen.getByLabelText(/Full name/i),
      'Charlie Example'
    )
    await user.type(
      screen.getByLabelText(/Email address/i),
      'charlie@example.com'
    )
    await user.type(
      screen.getByLabelText(/How can we help\?/i),
      'Help with account'
    )

    const submitButton = screen.getByRole('button', {
      name: /Send message/i,
    })
    const clickPromise = user.click(submitButton)

    await waitFor(() => expect(submitButton).toBeDisabled())
    resolveRequest?.()
    await clickPromise

    await waitFor(() => expect(submitButton).not.toBeDisabled())
  })
})
