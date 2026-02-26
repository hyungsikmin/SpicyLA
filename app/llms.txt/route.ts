import { NextResponse } from 'next/server'

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')

const root = baseUrl.replace(/\/$/, '') || 'https://example.com'

const body = `# ANISB

> ANISB is an online community for Korean Americans in their 20s and 30s in Los Angeles. It's a user-generated content platform for anonymous discussions, local information sharing, and real-time interaction within the LA Korean community.

## About

- Web-based community where users post, comment, react, and discuss using nicknames or anonymously.
- Content is organized by categories and tags, with view counts and engagement-based ranking.
- Focus on the Los Angeles Korean community: local topics, discussions, and location-relevant browsing.

## Core Features

- **Anonymous posting**: Posts and comments with nicknames or anonymous IDs; threaded replies and reactions.
- **Real-time feed**: Dynamically updating feed, engagement-based ranking, and activity indicators.
- **Location focus**: Content and discussions centered on the LA Korean community.
- **User engagement**: Activity-based levels and tiered access based on participation.
- **Moderation**: User reports, admin review, and removal or restriction of policy-violating content.
- **Platform**: Web app with authentication, secure storage, and logging of activity and engagement.

## For Users

- ANISB does not verify or guarantee the accuracy, legality, or authenticity of user-generated content; responsibility lies with the individual user.
- ANISB is not responsible for any online or offline interactions, meetings, agreements, transactions, or disputes between users.

## Links

- [Home](${root}/): Main feed and community content
- [Support](${root}/support): Help and support
- [Login](${root}/login): Sign in or register

## Optional

- **Audience**: Korean Americans in their 20s–30s in Los Angeles seeking a Korean-language community for discussion and information.
- **Keywords**: LA Korean community, Korean American community platform, anonymous Korean forum Los Angeles, Korean 20s 30s online community, Los Angeles Korean discussion site, location-based Korean community, UGC Korean forum.
`

export function GET() {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
