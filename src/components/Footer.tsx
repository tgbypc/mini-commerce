'use client'

import Link from 'next/link'
import { useI18n } from '@/context/I18nContext'

const NAV_LINKS: Array<{ key: 'home' | 'store' | 'about' | 'contact'; href: string }> = [
  { key: 'home', href: '/' },
  { key: 'store', href: '/store' },
  { key: 'about', href: '/about' },
  { key: 'contact', href: '/contact' },
]

const SUPPORT_LINKS: Array<{ key: 'orders' | 'shipping' | 'returns' | 'contact'; href: string }> = [
  { key: 'orders', href: '/user/orders' },
  { key: 'shipping', href: '/store#store-benefits' },
  { key: 'returns', href: '/contact#faq' },
  { key: 'contact', href: '/contact' },
]

const SOCIAL_LINKS: Array<{ key: 'instagram' | 'pinterest' | 'linkedin'; href: string }> = [
  { key: 'instagram', href: 'https://instagram.com' },
  { key: 'pinterest', href: 'https://pinterest.com' },
  { key: 'linkedin', href: 'https://linkedin.com/company' },
]

export default function Footer() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-gradient-to-br from-[#0d141c] via-[#272162] to-[#5b5bd6] px-4 py-12 text-white md:py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
          <div className="max-w-md space-y-3">
            <Link href="/" className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
              <span>MiniCommerce</span>
            </Link>
            <p className="text-sm text-white/70">{t('footer.about')}</p>
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map(({ key, href }) => (
                <Link
                  key={key}
                  href={href}
                  aria-label={t(`footer.social.${key}`)}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition hover:border-white/40 hover:bg-white/10"
                >
                  {renderSocialIcon(key)}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid flex-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
                {t('footer.shop.title')}
              </h3>
              <ul className="space-y-2 text-sm text-white/80">
                {NAV_LINKS.map(({ key, href }) => (
                  <li key={key}>
                    <Link href={href} className="transition hover:text-white">
                      {t(`footer.shop.links.${key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
                {t('footer.support.title')}
              </h3>
              <ul className="space-y-2 text-sm text-white/80">
                {SUPPORT_LINKS.map(({ key, href }) => (
                  <li key={key}>
                    <Link href={href} className="transition hover:text-white">
                      {t(`footer.support.links.${key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
                {t('footer.newsletter.title')}
              </h3>
              <p className="text-sm text-white/70">{t('footer.newsletter.description')}</p>
              <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
                <label className="sr-only" htmlFor="footer-email">
                  {t('footer.newsletter.emailLabel')}
                </label>
                <input
                  id="footer-email"
                  type="email"
                  placeholder={t('footer.newsletter.placeholder')}
                  className="w-full rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                />
                <button type="submit" className="btn-muted w-full">
                  {t('footer.newsletter.submit')}
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© {year} MiniCommerce. {t('footer.legal.rights')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/privacy" className="transition hover:text-white">
              {t('footer.legal.privacy')}
            </Link>
            <span aria-hidden>•</span>
            <Link href="/terms" className="transition hover:text-white">
              {t('footer.legal.terms')}
            </Link>
            <span aria-hidden>•</span>
            <Link href="mailto:privacy@minicommerce.com" className="transition hover:text-white">
              {t('footer.legal.contact')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

type SocialKey = (typeof SOCIAL_LINKS)[number]['key']

function renderSocialIcon(key: SocialKey) {
  switch (key) {
    case 'instagram':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M16.5 3h-9A4.5 4.5 0 0 0 3 7.5v9A4.5 4.5 0 0 0 7.5 21h9A4.5 4.5 0 0 0 21 16.5v-9A4.5 4.5 0 0 0 16.5 3Zm-4.5 13a4 4 0 1 1 0-8a4 4 0 0 1 0 8Zm5-7.5a1 1 0 1 1 0-2a1 1 0 0 1 0 2Z"
            fill="currentColor"
          />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      )
    case 'pinterest':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12.04 3C7.657 3 5 6.024 5 9.56c0 1.592.87 3.576 2.262 4.2c.212.096.162-.004.31-.596c.033-.136.17-.568.17-.568c.084.16.332.32.593.32c.78 0 1.344-1.053 1.344-2.332c0-1.1-.46-1.922-1.136-1.922c-.4 0-.71.324-.71.764c0 .44.278 1.094.41 1.706c.118.504-.25.912-.746.912c-.872 0-1.385-1.12-1.385-2.452c0-1.608 1.158-2.78 2.813-2.78c1.52 0 2.666 1.082 2.666 2.53c0 1.704-.672 3.146-1.668 3.146c-.55 0-.962-.45-.83-1.006c.16-.648.47-1.35.47-1.82c0-.42-.224-.77-.686-.77c-.544 0-.982.562-.982 1.316c0 .48.164.806.164.806s-.53 2.25-.624 2.65c-.108.462-.064 1.098-.018 1.51C7.488 16.872 8.64 17 9.342 17c.6 0 .714-.438.714-.438s.16-.6.236-.897c.582.888 1.356 1.21 2.334 1.21c3.034 0 5.316-2.624 5.316-5.864C18 5.3 15.598 3 12.04 3Z"
            fill="currentColor"
          />
        </svg>
      )
    case 'linkedin':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M6.5 6a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0ZM6 9H2v12h4V9Zm5 0H7v12h4v-6c0-1.326.895-2 2-2s2 .674 2 2v6h4v-7.5C19 10.119 17.657 9 16 9c-1.233 0-2.676.602-3 2h-.05V9Z"
            fill="currentColor"
          />
        </svg>
      )
    default:
      return null
  }
}
