type MaybeArray = string | string[]

type SendArgs = {
  to: MaybeArray
  subject: string
  html?: string
  text?: string
  cc?: MaybeArray
  bcc?: MaybeArray
}

function normalizeRecipients(value?: MaybeArray): string[] | undefined {
  if (!value) return undefined
  const arr = Array.isArray(value) ? value : [value]
  const cleaned = arr.map((item) => item?.trim()).filter((item): item is string => Boolean(item))
  return cleaned.length ? cleaned : undefined
}

export async function sendEmail({ to, subject, html, text, cc, bcc }: SendArgs): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM
    const devBypass = process.env.RESEND_DISABLE === '1'

    if (devBypass) {
      const toNormalized = normalizeRecipients(to) ?? []
      console.log('[resend:disabled]', { to: toNormalized, subject })
      return { ok: true, id: 'mocked-resend-disabled' }
    }
    if (!apiKey || !from) {
      return { ok: false, error: 'Missing RESEND_API_KEY or RESEND_FROM' }
    }

    const toNormalized = normalizeRecipients(to)
    if (!toNormalized) {
      return { ok: false, error: 'Missing recipient email address' }
    }

    const payload: Record<string, unknown> = {
      from,
      to: toNormalized,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    }

    const ccNormalized = normalizeRecipients(cc)
    if (ccNormalized) payload.cc = ccNormalized
    const bccNormalized = normalizeRecipients(bcc)
    if (bccNormalized) payload.bcc = bccNormalized

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { ok: false, error: `Resend error: ${res.status} ${errText}` }
    }
    const data = (await res.json()) as { id?: string }
    return { ok: true, id: data?.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Email send failed'
    return { ok: false, error: msg }
  }
}
