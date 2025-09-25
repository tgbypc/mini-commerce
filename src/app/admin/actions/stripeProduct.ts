
import Stripe from 'stripe'
import { db } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

export async function upsertStripeForProduct({
  productId, 
  title,
  description,
  price,     
  images = [],// string[]
}: {
  productId: string
  title: string
  description?: string
  price: number
  images?: string[]
}) {
 
  const product = await stripe.products.create({
    name: title,
    description,
    images,
    metadata: { productId }, 
  })

  
  const stripePrice = await stripe.prices.create({
    currency: 'usd',
    unit_amount: Math.round(price * 100),
    product: product.id,
    metadata: { productId }, 
  })

  
  await updateDoc(doc(db, 'products', productId), {
    stripeProductId: product.id,
    stripePriceId: stripePrice.id,
  })
}