import type { Metadata } from 'next'
import './globals.css'
import { Inter, Roboto_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { CartProvider } from '@/context/CartContext'
import { FavoritesProvider } from '@/context/FavoritesContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { I18nProvider } from '@/context/I18nContext'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'

const GeistSans = Inter({ subsets: ['latin'], variable: '--font-geist-sans' })
const GeistMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

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
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
              <CartProvider>
                <FavoritesProvider>
                  <Navbar />
                  <main>{children}</main>
                  <Footer />
                </FavoritesProvider>
              </CartProvider>
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="bottom-center" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  )
}
