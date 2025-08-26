// ör: src/app/admin/actions/stripeProduct.ts (server action)
import Stripe from 'stripe'
import { db } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

export async function upsertStripeForProduct({
  productId, // Firestore doküman id (sende numeric/string olabilir)
  title,
  description,
  price,      // number (USD)
  images = [],// string[]
}: {
  productId: string
  title: string
  description?: string
  price: number
  images?: string[]
}) {
  // 1) Stripe Product
  const product = await stripe.products.create({
    name: title,
    description,
    images,
    metadata: { productId }, // webhook’ta da eşleştirme için güzel
  })

  // 2) Stripe Price
  const stripePrice = await stripe.prices.create({
    currency: 'usd',
    unit_amount: Math.round(price * 100),
    product: product.id,
    metadata: { productId }, // add this line
  })

  // 3) Firestore’a yaz
  await updateDoc(doc(db, 'products', productId), {
    stripeProductId: product.id,
    stripePriceId: stripePrice.id,
  })
}