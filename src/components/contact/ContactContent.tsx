'use client'

import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useI18n } from '@/context/I18nContext'

const topicOptions = ['general', 'order', 'returns', 'partnership'] as const
const faqKeys = ['shipping', 'returns', 'payment'] as const
const locationKeys = ['oslo', 'stockholm'] as const

export default function ContactContent() {
  const { t } = useI18n()
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    topic: 'general' as (typeof topicOptions)[number],
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 600))
      toast.success(t('contact.form.success'))
      setFormState({ name: '', email: '', topic: 'general', message: '' })
    } catch {
      toast.error(t('contact.form.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-[#f6f7fb] px-4 py-10 md:py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <section className="relative overflow-hidden rounded-4xl border border-zinc-200 bg-white/95 px-6 py-10 shadow-[0_24px_48px_rgba(15,23,42,0.08)] sm:px-10">
          <div
            className="absolute -right-16 top-[-30%] size-80 rounded-full bg-gradient-to-br from-[#ffeef8] via-white to-[#e6f1ff] blur-3xl"
            aria-hidden
          />
          <div className="relative z-[1] space-y-4">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-[#f6f7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              {t('contact.hero.kicker')}
            </span>
            <h1 className="text-3xl font-semibold text-[#0d141c] md:text-4xl">
              {t('contact.hero.title')}
            </h1>
            <p className="max-w-3xl text-sm text-zinc-600 md:text-base">
              {t('contact.hero.subtitle')}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {['support', 'sales', 'press'].map((key) => (
                <div
                  key={key}
                  className="surface-card bg-white/95 px-4 py-4 text-sm text-[#0d141c]"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.23em] text-zinc-500">
                    {t(`contact.cards.${key}.title`)}
                  </div>
                  <p className="mt-1 text-zinc-600">
                    {t(`contact.cards.${key}.description`)}
                  </p>
                  <Link
                    href={`mailto:${t(`contact.cards.${key}.email`)}`}
                    className="mt-3 inline-flex items-center text-sm font-semibold text-[#4338ca] transition hover:text-[#5b5bd6]"
                  >
                    {t(`contact.cards.${key}.email`)}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 surface-card px-6 py-6 sm:px-8"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-[#0d141c]">
                {t('contact.form.title')}
              </h2>
              <p className="text-sm text-zinc-600">
                {t('contact.form.description')}
              </p>
            </div>
            <label className="text-sm font-medium text-zinc-600">
              {t('contact.form.fields.name')}
              <input
                name="name"
                value={formState.name}
                onChange={handleChange}
                required
                className="mt-1 h-11 w-full rounded-2xl border border-zinc-200 bg-[#f6f7fb] px-4 text-sm text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
              />
            </label>
            <label className="text-sm font-medium text-zinc-600">
              {t('contact.form.fields.email')}
              <input
                type="email"
                name="email"
                value={formState.email}
                onChange={handleChange}
                required
                className="mt-1 h-11 w-full rounded-2xl border border-zinc-200 bg-[#f6f7fb] px-4 text-sm text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
              />
            </label>
            <label className="text-sm font-medium text-zinc-600">
              {t('contact.form.fields.topic')}
              <select
                name="topic"
                value={formState.topic}
                onChange={handleChange}
                className="mt-1 h-11 w-full rounded-2xl border border-zinc-200 bg-[#f6f7fb] px-4 text-sm text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
              >
                {topicOptions.map((option) => (
                  <option key={option} value={option}>
                    {t(`contact.form.topicOptions.${option}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-600">
              {t('contact.form.fields.message')}
              <textarea
                name="message"
                value={formState.message}
                onChange={handleChange}
                required
                rows={5}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-[#f6f7fb] px-4 py-3 text-sm text-[#0d141c] focus:border-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0d141c]/10"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 btn-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting
                ? t('contact.form.submitting')
                : t('contact.form.submit')}
            </button>
          </form>

          <div className="flex flex-col gap-6">
            <div className="surface-card px-6 py-6 sm:px-8">
              <h2 className="text-xl font-semibold text-[#0d141c]">
                {t('contact.locations.title')}
              </h2>
              <div className="mt-4 space-y-4 text-sm text-zinc-600">
                {locationKeys.map((key) => (
                  <div key={key} className="surface-card bg-white px-4 py-4">
                    <div className="text-sm font-semibold text-[#0d141c]">
                      {t(`contact.locations.items.${key}.name`)}
                    </div>
                    <p>{t(`contact.locations.items.${key}.address`)}</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                      {t(`contact.locations.items.${key}.hours`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div id="faq" className="surface-card px-6 py-6 sm:px-8">
              <h2 className="text-xl font-semibold text-[#0d141c]">
                {t('contact.faq.title')}
              </h2>
              <div className="mt-4 space-y-4 text-sm text-zinc-600">
                {faqKeys.map((key) => (
                  <details
                    key={key}
                    className="rounded-3xl border border-[#5b5bd6]/20 bg-white px-4 py-3"
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-[#0d141c]">
                      {t(`contact.faq.items.${key}.question`)}
                    </summary>
                    <p className="mt-2 text-sm text-zinc-600">
                      {t(`contact.faq.items.${key}.answer`)}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
