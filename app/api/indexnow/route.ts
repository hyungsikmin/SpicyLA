import { NextRequest, NextResponse } from 'next/server'

const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY ?? 'f6a5a643e7ef4289a68dd12f87145a1a'
const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
const root = baseUrl.replace(/\/$/, '') || 'https://anisb.com'
const keyLocation = `${root}/${INDEXNOW_KEY}.txt`
const host = new URL(root).host

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const urlList = Array.isArray(body?.urlList) ? body.urlList : []
    if (urlList.length === 0) {
      return NextResponse.json({ error: 'urlList required' }, { status: 400 })
    }
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation,
        urlList: urlList.slice(0, 10000),
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[indexnow]', res.status, text)
      return NextResponse.json(
        { error: 'IndexNow submission failed', status: res.status },
        { status: 502 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[indexnow]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    )
  }
}
