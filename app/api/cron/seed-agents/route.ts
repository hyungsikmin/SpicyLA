/**
 * GET/POST /api/cron/seed-agents
 * 시드 에이전트 2~3명 랜덤 선택 후 각각 투표/리액션 수행.
 * Vercel Cron은 GET으로 호출함 → GET도 처리해야 10분마다 동작.
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 ?secret=<CRON_SECRET>
 */
import { NextResponse } from 'next/server'
import { getSeedsWithPersonas, runOneSeedAgent } from '@/lib/seedAgent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

function isAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ') && auth.slice(7).trim() === CRON_SECRET) return true
  const { searchParams } = new URL(request.url)
  if (searchParams.get('secret') === CRON_SECRET) return true
  // Vercel Cron이 GET으로 호출할 때 Authorization을 안 붙이는 경우가 있음 → User-Agent로 허용
  if (request.method === 'GET' && request.headers.get('user-agent') === 'vercel-cron/1.0') return true
  return false
}

async function runCron() {
  const seeds = await getSeedsWithPersonas()
  if (seeds.length === 0) {
    return NextResponse.json({ ok: true, run: 0, message: 'no seeds' })
  }
  const count = Math.min(2 + Math.floor(Math.random() * 2), seeds.length)
  const shuffled = [...seeds].sort(() => Math.random() - 0.5)
  const toRun = shuffled.slice(0, count)
  const results: { email: string; ok: boolean; action?: string; id?: string; error?: string }[] = []
  for (const seed of toRun) {
    try {
      const result = await runOneSeedAgent(seed)
      if (result.ok) {
        const id = result.action === 'comment' ? result.commentId : result.postId
        results.push({ email: seed.email, ok: true, action: result.action, id })
      } else {
        results.push({ email: seed.email, ok: false, error: result.error })
      }
    } catch (e) {
      results.push({ email: seed.email, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return NextResponse.json({ ok: true, run: results.length, results })
}

/** Vercel Cron이 10분마다 GET으로 호출함 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runCron()
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runCron()
}
