import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { auth, adminDb, FieldValue } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'

const COLLECTION = 'emailVerificationTokens'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

type TokenDoc = {
  uid: string
  email: string
  tokenHash: string
  createdAtMs: number
  expiresAtMs: number
  consumed: boolean
  consumedReason?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as { token?: string } | null
    const token = body?.token?.trim()
    if (!token) {
      return NextResponse.json({ error: 'Token eksik' }, { status: 400 })
    }

    const tokenHash = hashToken(token)
    const docRef = adminDb.collection(COLLECTION).doc(tokenHash)
    const snap = await docRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Geçersiz veya kullanılmış bağlantı' }, { status: 400 })
    }

    const data = snap.data() as TokenDoc
    if (data.consumed) {
      return NextResponse.json({ error: 'Bu bağlantı daha önce kullanılmış', reason: data.consumedReason || 'consumed' }, { status: 410 })
    }

    const now = Date.now()
    if (data.expiresAtMs && data.expiresAtMs < now) {
      await docRef.update({ consumed: true, consumedReason: 'expired', consumedAt: FieldValue.serverTimestamp() })
      return NextResponse.json({ error: 'Bağlantının süresi dolmuş' }, { status: 410 })
    }

    try {
      await auth.updateUser(data.uid, { emailVerified: true })
    } catch (err) {
      console.error('Email verification updateUser error', err)
      return NextResponse.json({ error: 'Kullanıcı doğrulanamadı' }, { status: 500 })
    }

    await adminDb.collection('users').doc(data.uid).set(
      {
        emailVerified: true,
        emailVerifiedAt: FieldValue.serverTimestamp(),
        email: data.email,
      },
      { merge: true }
    )

    await docRef.update({ consumed: true, consumedReason: 'verified', consumedAt: FieldValue.serverTimestamp() })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Email verification confirm error', err)
    return NextResponse.json({ error: 'Beklenmeyen bir hata oluştu' }, { status: 500 })
  }
}
