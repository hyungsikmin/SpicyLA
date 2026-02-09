import { NextResponse } from 'next/server'

const FETCH_TIMEOUT_MS = 8000

/** GET /api/og?url=... — 대상 URL HTML에서 og:image(또는 twitter:image) 추출해 이미지 URL 반환 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('url')
  if (!raw || typeof raw !== 'string') {
    return NextResponse.json({ imageUrl: null }, { status: 400 })
  }
  let targetUrl: URL
  try {
    targetUrl = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return NextResponse.json({ imageUrl: null }, { status: 400 })
  }
  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return NextResponse.json({ imageUrl: null }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(targetUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnisbiBot/1.0; +https://anisbi.com)',
      },
      redirect: 'follow',
    })
    clearTimeout(timeout)
    if (!res.ok) return NextResponse.json({ imageUrl: null })
    const html = await res.text()
    const imageUrl = extractOgImage(html, res.url)
    return NextResponse.json({ imageUrl })
  } catch {
    clearTimeout(timeout)
    return NextResponse.json({ imageUrl: null })
  }
}

function extractOgImage(html: string, baseUrl: string): string | null {
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (ogImage?.[1]) return resolveUrl(ogImage[1], baseUrl)
  const twitterImage = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
  if (twitterImage?.[1]) return resolveUrl(twitterImage[1], baseUrl)
  return null
}

function resolveUrl(href: string, baseUrl: string): string {
  const trimmed = href.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  try {
    return new URL(trimmed, baseUrl).href
  } catch {
    return trimmed
  }
}
