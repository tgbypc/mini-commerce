// Minimal email helper using Resend's HTTP API to avoid extra deps
// Set env vars on Vercel: RESEND_API_KEY and RESEND_FROM (e.g. "Shop <noreply@yourdomain.com>")

type SendArgs = {
  to: string
  subject: string
  html?: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM
    if (!apiKey || !from) {
      return { ok: false, error: 'Missing RESEND_API_KEY or RESEND_FROM' }
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
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

