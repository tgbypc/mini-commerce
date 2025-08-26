// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// NOT: Next.js client bundle içinde process.env'nin dinamik indexlenmesi çalışmaz.
// Bu yüzden döngüyle env kontrolü yapmıyoruz.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,        // <-- DOĞRUDAN erişim
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // opsiyonel
};

// (İstersen sadece server tarafında soft-check yapabilirsin)
if (typeof window === "undefined") {
  for (const [k, v] of Object.entries(firebaseConfig)) {
    if (!v) {
      console.warn(`[firebase] Missing env for ${k}. Check your .env.local`);
    }
  }
}

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);