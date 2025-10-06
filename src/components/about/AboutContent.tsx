'use client'

import Link from 'next/link'
import { useI18n } from '@/context/I18nContext'

const timelineKeys = ['founded', 'marketplace', 'growth', 'today'] as const
const valueKeys = ['people', 'planet', 'progress'] as const
const teamKeys = ['ceo', 'headOfProduct', 'customerLead'] as const

export default function AboutContent() {
  const { t } = useI18n()

  const metrics = [
    { label: t('about.hero.metrics.customers'), value: '180K+' },
    { label: t('about.hero.metrics.partners'), value: '320' },
    { label: t('about.hero.metrics.countries'), value: '18' },
  ]

  return (
    <div className="bg-[#f6f7fb] px-4 py-10 md:py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <section className="relative overflow-hidden rounded-4xl border border-zinc-200 bg-white/95 px-6 py-12 shadow-[0_28px_56px_rgba(15,23,42,0.1)] sm:px-10">
          <div className="absolute -right-24 top-0 size-80 rounded-full bg-gradient-to-br from-[#e3ecff] via-white to-[#f5f7ff] blur-3xl" aria-hidden />
          <div className="relative z-[1] space-y-6">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f6f7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              {t('about.hero.kicker')}
            </span>
            <h1 className="text-3xl font-semibold text-[#0d141c] md:text-4xl">{t('about.hero.title')}</h1>
            <p className="max-w-3xl text-sm text-zinc-600 md:text-base">{t('about.hero.subtitle')}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-zinc-200 bg-[#f6f7fb] px-4 py-5 text-center shadow-sm">
                  <div className="text-2xl font-semibold text-[#0d141c]">{metric.value}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="about-story" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-4">
            <h2 id="about-story" className="text-2xl font-semibold text-[#0d141c]">{t('about.story.title')}</h2>
            <p className="text-sm text-zinc-600">{t('about.story.paragraphOne')}</p>
            <p className="text-sm text-zinc-600">{t('about.story.paragraphTwo')}</p>
            <p className="text-sm text-zinc-600">{t('about.story.paragraphThree')}</p>
          </div>
          <div className="space-y-4 rounded-4xl border border-zinc-200 bg-white/95 px-6 py-6 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
            <h3 className="text-lg font-semibold text-[#0d141c]">{t('about.timeline.title')}</h3>
            <ol className="space-y-4 text-sm text-zinc-600">
              {timelineKeys.map((key) => (
                <li key={key} className="rounded-2xl border border-zinc-200/70 bg-[#f6f7fb] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0d141c]">
                    {t(`about.timeline.items.${key}.year`)}
                  </div>
                  <div className="font-semibold text-[#0d141c]">{t(`about.timeline.items.${key}.title`)}</div>
                  <p>{t(`about.timeline.items.${key}.description`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="about-values" className="space-y-6">
          <div className="flex flex-col gap-2">
            <h2 id="about-values" className="text-2xl font-semibold text-[#0d141c]">{t('about.values.title')}</h2>
            <p className="text-sm text-zinc-600">{t('about.values.subtitle')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {valueKeys.map((key) => (
              <div key={key} className="rounded-3xl border border-zinc-200 bg-white/95 px-5 py-5 shadow-sm">
                <div className="text-sm font-semibold text-[#0d141c]">{t(`about.values.items.${key}.title`)}</div>
                <p className="mt-2 text-sm text-zinc-600">{t(`about.values.items.${key}.description`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="about-team" className="space-y-6">
          <div className="flex flex-col gap-2">
            <h2 id="about-team" className="text-2xl font-semibold text-[#0d141c]">{t('about.team.title')}</h2>
            <p className="text-sm text-zinc-600">{t('about.team.subtitle')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {teamKeys.map((key) => (
              <div key={key} className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white/95 px-5 py-5 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-dark)]/10 text-lg font-semibold text-[#0d141c]">
                  {t(`about.team.members.${key}.initials`)}
                </div>
                <div className="space-y-1 text-sm text-[#0d141c]">
                  <div className="font-semibold">{t(`about.team.members.${key}.name`)}</div>
                  <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">{t(`about.team.members.${key}.role`)}</div>
                  <p className="text-sm text-zinc-600">{t(`about.team.members.${key}.bio`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-4xl border border-zinc-200 bg-[var(--color-primary-dark)] px-6 py-10 text-white shadow-[0_28px_56px_rgba(15,23,42,0.35)] sm:px-10">
          <div className="absolute -left-24 top-0 size-72 rounded-full bg-white/15 blur-3xl" aria-hidden />
          <div className="relative z-[1] flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold md:text-3xl">{t('about.cta.title')}</h2>
              <p className="text-sm text-white/80 md:text-base">{t('about.cta.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/store" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0d141c] transition hover:bg-white/90">
                {t('about.cta.primaryCta')}
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center rounded-full border border-white/50 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t('about.cta.secondaryCta')}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
