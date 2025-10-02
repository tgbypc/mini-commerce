import nodemailer from 'nodemailer'

export type SendArgs = {
  to: string
  subject: string
  html?: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<{ ok: boolean; previewUrl?: string; error?: string }> {
  try {
    const transporter = await nodemailer.createTestAccount().then((testAccount) => {
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      })
    })

    const info = await transporter.sendMail({ from: 'MiniCommerce <demo@ethereal.email>', to, subject, html, text })

    return { ok: true, previewUrl: nodemailer.getTestMessageUrl(info) ?? undefined }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Email send failed',
    }
  }
}

