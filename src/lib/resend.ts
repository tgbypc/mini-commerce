const RESEND_ENDPOINT = 'https://api.resend.com/emails'

type SendEmailPayload = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
}

export async function sendEmailViaResend({
  to,
  subject,
  html,
  text,
}: SendEmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const from =
    process.env.RESEND_FROM || 'MiniCommerce <no-reply@mini-commerce.dev>'
  const recipients = Array.isArray(to) ? to : [to]
  if (!recipients.length) {
    throw new Error('Recipient email is required')
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      html: html ? html : text ? `<p>${text}</p>` : undefined,
      text,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(
      `Resend API error (${response.status}): ${
        errorBody || response.statusText
      }`
    )
  }

  return (await response.json()) as unknown
}

