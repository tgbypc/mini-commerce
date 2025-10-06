declare module 'nodemailer' {
  interface TestAccount {
    user: string
    pass: string
  }

  interface SMTPAuth {
    user: string
    pass: string
  }

  interface SMTPTransportOptions {
    host: string
    port: number
    secure?: boolean
    auth?: SMTPAuth
  }

  interface SendMailOptions {
    from?: string
    to?: string | string[]
    subject?: string
    html?: string
    text?: string
  }

  interface SentMessageInfo {
    messageId: string
    response?: string
    envelope?: {
      from: string
      to: string[]
    }
    accepted?: string[]
    rejected?: string[]
  }

  interface Transporter {
    sendMail(mailOptions: SendMailOptions): Promise<SentMessageInfo>
  }

  function createTestAccount(): Promise<TestAccount>
  function createTransport(options: SMTPTransportOptions): Transporter
  function getTestMessageUrl(info: SentMessageInfo): string | false

  const nodemailer: {
    createTestAccount: typeof createTestAccount
    createTransport: typeof createTransport
    getTestMessageUrl: typeof getTestMessageUrl
  }

  export default nodemailer
  export {
    createTestAccount,
    createTransport,
    getTestMessageUrl,
    Transporter,
    SendMailOptions,
    SentMessageInfo,
    TestAccount,
  }
}
