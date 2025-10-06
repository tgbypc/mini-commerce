import Script from 'next/script'
import type { Metadata } from 'next'
import ContactContent from '@/components/contact/ContactContent'

const title = 'Contact MiniCommerce | Support, partnerships & press'
const description =
  'Reach our support specialists, explore partnership opportunities or request press materials. We respond to all inquiries within one business day.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    url: 'https://minicommerce.example/contact',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: title,
  description,
  url: 'https://minicommerce.example/contact',
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@minicommerce.com',
      availableLanguage: ['English', 'Norwegian'],
    },
    {
      '@type': 'ContactPoint',
      contactType: 'partnerships',
      email: 'partners@minicommerce.com',
    },
  ],
}

export default function ContactPage() {
  return (
    <>
      <Script id="ld-contact" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>
      <ContactContent />
    </>
  )
}
