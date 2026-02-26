import { NextResponse } from 'next/server'

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')

const root = baseUrl.replace(/\/$/, '') || 'https://example.com'

const body = `# 아니스비 (ANISB)

아니스비는 LA 20·30 익명 커뮤니티입니다. Reddit 스타일의 익명 게시판으로, 정치·종교·욕설 없이 편하게 이야기를 나눌 수 있는 공간입니다.

## 주요 페이지

- 홈 (피드): ${root}/
- 게시글: ${root}/p/[id]
- 고객지원: ${root}/support

## 설명

이용약관과 커뮤니티 규칙을 준수하며, 모두가 부담 없이 솔직하게 대화할 수 있는 환경을 지향합니다.
`

export function GET() {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
