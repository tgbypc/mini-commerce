import type { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  const config: MetadataRoute.Robots = {
    rules: [{ userAgent: '*', allow: '/' }],
  }

  if (baseUrl) {
    config.host = baseUrl
    config.sitemap = [`${baseUrl}/sitemap.xml`]
  }

  return config
}