import admin from 'firebase-admin'

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.error(
    'FIREBASE_SERVICE_ACCOUNT_JSON env var is required. Supply a JSON stringified service account.'
  )
  process.exit(1)
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@demo.com'
  const password = process.env.ADMIN_PASSWORD ?? 'StrongPassword123!'
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'Demo Admin'

  console.log(`Creating Firebase auth user for ${email}...`)
  const user = await admin
    .auth()
    .createUser({ email, password, displayName })
    .catch(async (err) => {
      if (err.code === 'auth/email-already-exists') {
        console.log('User already exists, fetching existing record...')
        return admin.auth().getUserByEmail(email)
      }
      throw err
    })

  console.log('Ensuring Firestore role document...')
  const db = admin.firestore()
  await db
    .collection('users')
    .doc(user.uid)
    .set(
      {
        email,
        role: 'admin',
        displayName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

  console.log('Admin user ready:', user.uid)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
