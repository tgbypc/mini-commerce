import type { Metadata } from 'next'
import './globals.css'
import { Inter, Roboto_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { CartProvider } from '@/context/CartContext'

const GeistSans = Inter({ subsets: ['latin'], variable: '--font-geist-sans' })
const GeistMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})
import Navbar from '@/components/Navbar'
import { AuthProvider } from '@/context/AuthContext' // ✅ ekledik

export const metadata: Metadata = {
  title: 'MiniCommerce',
  description: 'E-commerce app with Next.js & Firebase',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <AuthProvider>
          {' '}
          <CartProvider>
            {/* ✅ Tüm uygulamayı sarmaladık */}
            <Navbar />
            {children}
          </CartProvider>
        </AuthProvider>

        <Toaster position="top-right" />
      </body>
    </html>
  )
}
