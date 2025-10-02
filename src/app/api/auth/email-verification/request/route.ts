import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { auth, adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { sendEmail } from '@/lib/email'

export const runtime = 'nodejs'

const TOKEN_BYTE_LENGTH = 32
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 // 24 saat
const RESEND_COOLDOWN_MS = 1000 * 60 // 60 saniye
const COLLECTION = 'emailVerificationTokens'

type TokenDoc = {
  uid: string
  email: string
  tokenHash: string
  createdAtMs: number
  expiresAtMs: number
  consumed: boolean
  consumedReason?: string
}

function createToken() {
  return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex')
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function emailVerificationUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const url = new URL('/verify-email', base)
  url.searchParams.set('token', token)
  return url.toString()
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Yetkisiz istek' }, { status: 401 })
    }

    const idToken = authHeader.slice(7).trim()

    let decoded
    try {
      decoded = await auth.verifyIdToken(idToken)
    } catch {
      return NextResponse.json({ error: 'Yetkisiz istek' }, { status: 401 })
    }

    const uid = decoded.uid
    const email = decoded.email
    if (!email) {
      return NextResponse.json({ error: 'Email adresi bulunamadı' }, { status: 400 })
    }

    if (decoded.email_verified) {
      return NextResponse.json({ error: 'Email zaten doğrulanmış' }, { status: 400 })
    }

    const now = Date.now()
    const tokenCol = adminDb.collection(COLLECTION)

    const existingSnap = await tokenCol
      .where('uid', '==', uid)
      .where('consumed', '==', false)
      .get()

    for (const doc of existingSnap.docs) {
      const data = doc.data() as TokenDoc
      if (now - (data.createdAtMs || 0) < RESEND_COOLDOWN_MS) {
        const waitMs = RESEND_COOLDOWN_MS - (now - (data.createdAtMs || 0))
        const waitSeconds = Math.ceil(waitMs / 1000)
        return NextResponse.json({ error: `Lütfen ${waitSeconds} saniye sonra tekrar deneyin` }, { status: 429 })
      }
      await doc.ref.update({ consumed: true, consumedReason: 'superseded', consumedAt: FieldValue.serverTimestamp() })
    }

    const token = createToken()
    const tokenHash = hashToken(token)
    const expiresAtMs = now + TOKEN_TTL_MS

    await tokenCol.doc(tokenHash).set({
      uid,
      email,
      tokenHash,
      createdAtMs: now,
      expiresAtMs,
      consumed: false,
      createdAt: FieldValue.serverTimestamp(),
    })

    const verifyUrl = emailVerificationUrl(token)
    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto">
        <h2 style="margin:0 0 12px">MiniCommerce hesabınızı doğrulayın</h2>
        <p style="margin:0 0 12px">E-postanızı doğrulamak için aşağıdaki butona tıklayın.</p>
        <p style="margin:0 0 24px">
          <a href="${verifyUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">E-postamı doğrula</a>
        </p>
        <p style="margin:0 0 12px">Buton çalışmazsa aşağıdaki bağlantıyı tarayıcınıza yapıştırın:</p>
        <p style="margin:0;background:#f4f4f5;padding:12px;border-radius:6px;word-break:break-all">${verifyUrl}</p>
        <p style="margin:24px 0 0;font-size:12px;color:#71717a">Bu bağlantı 24 saat içinde geçerliliğini yitirir.</p>
      </div>
    `

    const text = `MiniCommerce hesabınızı doğrulamak için aşağıdaki bağlantıyı kullanın:\n\n${verifyUrl}\n\nBağlantı 24 saat sonra geçerliliğini yitirir.`

    const sendResult = await sendEmail({
      to: email,
      subject: 'MiniCommerce e-posta doğrulaması',
      html,
      text,
    })

    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error || 'E-posta gönderilemedi' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Email verification request error', err)
    return NextResponse.json({ error: 'Beklenmeyen bir hata oluştu' }, { status: 500 })
  }
}
