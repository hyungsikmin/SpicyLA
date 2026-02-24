/**
 * GET/POST /api/cron/seed-agents
 * 시드 에이전트 20명 랜덤 선택 후 각각 투표/리액션 수행.
 * + 오늘 점메추 추천 아이템당 리액션(투표) 1개씩 시드가 넣음.
 * Vercel Cron은 GET으로 호출함 → GET도 처리해야 10분마다 동작.
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 ?secret=<CRON_SECRET>
 */
import { NextResponse } from 'next/server'
import { getSeedsWithPersonas, runOneSeedAgent, runOneLunchVote } from '@/lib/seedAgent'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim()

function isAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ') && auth.slice(7).trim() === CRON_SECRET) return true
  const { searchParams } = new URL(request.url)
  const secretParam = searchParams.get('secret')?.trim() ?? ''
  if (secretParam && secretParam === CRON_SECRET) return true
  // Vercel Cron이 GET으로 호출할 때 Authorization을 안 붙이는 경우가 있음 → User-Agent로 허용
  if (request.method === 'GET' && request.headers.get('user-agent') === 'vercel-cron/1.0') return true
  return false
}

async function runCron() {
  const seeds = await getSeedsWithPersonas()
  if (seeds.length === 0) {
    return NextResponse.json({ ok: true, run: 0, message: 'no seeds' })
  }
  const count = Math.min(20, seeds.length)
  const shuffled = [...seeds].sort(() => Math.random() - 0.5)
  const toRun = shuffled.slice(0, count)
  const results: { email: string; ok: boolean; action?: string; id?: string; error?: string }[] = []
  for (const seed of toRun) {
    try {
      const result = await runOneSeedAgent(seed)
      if (result.ok) {
        const id = (result.action === 'comment' || result.action === 'comment_like') ? result.commentId : result.postId
        results.push({ email: seed.email, ok: true, action: result.action, id })
      } else {
        results.push({ email: seed.email, ok: false, error: result.error })
      }
    } catch (e) {
      results.push({ email: seed.email, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // 오늘 점메추 추천 아이템당 리액션(투표) 1개씩 — 각 추천당 아직 투표 안 한 시드 1명이 want/unsure/wtf 중 하나로 투표
  const lunchResults: { recommendationId: string; ok: boolean; error?: string }[] = []
  try {
    const admin = getSupabaseAdmin()
    const { data: settingsRows } = await admin.from('site_settings').select('key, value_json').in('key', ['lunch_deadline_hour', 'lunch_timezone'])
    let deadlineHour = 12
    let timezone = 'America/Los_Angeles'
    ;(settingsRows ?? []).forEach((row: { key: string; value_json: unknown }) => {
      const v = row.value_json
      if (row.key === 'lunch_timezone' && typeof v === 'string') timezone = v
      else if (row.key === 'lunch_deadline_hour') {
        if (typeof v === 'number' && Number.isFinite(v)) deadlineHour = v
        else if (typeof v === 'string' && /^\d+$/.test(v)) deadlineHour = parseInt(v, 10)
      }
    })
    const { data: round, error: roundErr } = await admin.rpc('get_or_create_today_lunch_round', {
      p_timezone: timezone,
      p_deadline_hour: deadlineHour,
    })
    if (roundErr || !round?.id) {
      // 오늘 라운드 없거나 RPC 실패 시 스킵
    } else {
      const roundId = (round as { id: string }).id
      const { data: recs } = await admin.from('lunch_recommendations').select('id').eq('round_id', roundId)
      const recommendations = (recs ?? []) as { id: string }[]
      const seedList = await getSeedsWithPersonas()
      for (const rec of recommendations) {
        const { data: votes } = await admin.from('lunch_votes').select('user_id').eq('recommendation_id', rec.id)
        const votedUserIds = new Set((votes ?? []).map((v: { user_id: string }) => v.user_id))
        let availableSeeds = seedList.filter((s) => !votedUserIds.has(s.user_id))
        if (availableSeeds.length === 0) {
          lunchResults.push({ recommendationId: rec.id, ok: false, error: 'no seed available' })
          continue
        }
        availableSeeds = [...availableSeeds].sort(() => Math.random() - 0.5)
        let lastError: string | undefined
        for (const seed of availableSeeds) {
          const out = await runOneLunchVote(seed, rec.id)
          if (out.ok) {
            lunchResults.push({ recommendationId: rec.id, ok: true })
            lastError = undefined
            break
          }
          lastError = out.error
          if (out.error !== 'seed login failed' && out.error !== 'already voted') break
        }
        if (lastError != null) lunchResults.push({ recommendationId: rec.id, ok: false, error: lastError })
      }
    }
  } catch (e) {
    lunchResults.push({ recommendationId: '', ok: false, error: e instanceof Error ? e.message : String(e) })
  }

  return NextResponse.json({
    ok: true,
    run: results.length,
    results,
    lunch: lunchResults.length ? { run: lunchResults.length, results: lunchResults } : undefined,
  })
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
