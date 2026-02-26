import type { MetadataRoute } from 'next'

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

export default function robots(): MetadataRoute.Robots {
  const sitemapUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/sitemap.xml` : undefined

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/auth/', '/login', '/profile', '/edit/', '/write', '/welcome', '/notifications', '/u/'] },
      { userAgent: 'Bingbot', allow: '/', disallow: ['/admin/', '/api/', '/auth/', '/login', '/profile', '/edit/', '/write', '/welcome', '/notifications', '/u/'] },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: ['/admin/', '/api/', '/auth/', '/login', '/profile', '/edit/', '/write', '/welcome', '/notifications', '/u/'] },
    ],
    ...(sitemapUrl ? { sitemap: sitemapUrl } : {}),
  }
}
