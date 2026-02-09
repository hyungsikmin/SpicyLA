import { supabase } from '@/lib/supabaseClient'
import { getAvatarUrl } from '@/lib/storage'

const LUNCH_TIMEZONE_DEFAULT = 'America/Los_Angeles'
const LUNCH_DEADLINE_HOUR_DEFAULT = 12

export type LunchSettings = {
  deadline_hour: number
  timezone: string
}

/** 점메추 마감 시각 설정 (대시보드에서 설정). */
export async function fetchLunchSettings(): Promise<LunchSettings> {
  const { data } = await supabase.from('site_settings').select('key, value_json').in('key', ['lunch_deadline_hour', 'lunch_timezone'])
  let deadlineHour = LUNCH_DEADLINE_HOUR_DEFAULT
  let timezone = LUNCH_TIMEZONE_DEFAULT
  ;(data ?? []).forEach((row: { key: string; value_json: unknown }) => {
    const v = row.value_json
    if (row.key === 'lunch_timezone' && typeof v === 'string') timezone = v
    else if (row.key === 'lunch_deadline_hour') {
      if (typeof v === 'number' && Number.isFinite(v)) deadlineHour = v
      else if (typeof v === 'string' && /^\d+$/.test(v)) deadlineHour = parseInt(v, 10)
    }
  })
  return { deadline_hour: deadlineHour, timezone }
}

export type LunchRound = {
  id: string
  round_date: string
  deadline_at: string
  status: 'open' | 'closed'
  winner_recommendation_id: string | null
  created_at: string
}

export type LunchRecommendation = {
  id: string
  round_id: string
  user_id: string
  restaurant_name: string
  location: string | null
  link_url: string | null
  one_line_reason: string
  created_at: string
}

export type LunchVote = {
  id: string
  recommendation_id: string
  user_id: string
  vote_type: 'want' | 'unsure' | 'wtf'
  created_at: string
}

export type RecommendationWithMeta = LunchRecommendation & {
  anon_name: string
  want_count: number
  unsure_count: number
  wtf_count: number
  score: number
  my_vote: 'want' | 'unsure' | 'wtf' | null
}

export type YesterdayWinner = {
  anon_name: string
  restaurant_name: string
  link_url: string | null
}

export type Last7DaysWinnerEntry = {
  round_date: string
  restaurant_name: string
  anon_name: string
  link_url: string | null
}

/** 오늘 점메추 참여 인원(추천 건 수). 라운드 없으면 0. */
export async function getTodayLunchParticipantCount(): Promise<number> {
  const round = await getOrCreateTodayRound(null)
  if (!round) return 0
  const { count, error } = await supabase
    .from('lunch_recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', round.id)
  if (error) return 0
  return count ?? 0
}

/** 오늘(설정 타임존) 라운드 가져오기. 없으면 생성 후 반환. 마감 시각은 설정 시간(PST 등) 기준. */
export async function getOrCreateTodayRound(settings?: LunchSettings | null): Promise<LunchRound | null> {
  const s = settings ?? await fetchLunchSettings()
  const { data, error } = await supabase.rpc('get_or_create_today_lunch_round', {
    p_timezone: s.timezone,
    p_deadline_hour: s.deadline_hour,
  })
  if (error) return null
  return data as LunchRound
}

/** 마감 시간 지났으면 라운드 닫고 우승자 설정. */
export async function closeRoundIfNeeded(roundId: string): Promise<void> {
  await supabase.rpc('close_lunch_round_and_set_winner', { p_round_id: roundId })
}

/** 해당 라운드의 추천 목록 + 프로필 anon_name + 투표 집계 + 내 투표. */
export async function fetchRecommendationsWithMeta(
  roundId: string,
  userId: string | undefined
): Promise<RecommendationWithMeta[]> {
  const { data: recs } = await supabase
    .from('lunch_recommendations')
    .select('id, round_id, user_id, restaurant_name, location, link_url, one_line_reason, created_at')
    .eq('round_id', roundId)
    .order('created_at', { ascending: true })

  if (!recs?.length) return []

  const recIds = recs.map((r) => r.id)
  const userIds = [...new Set(recs.map((r) => r.user_id))]

  const [profilesRes, votesRes] = await Promise.all([
    supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds),
    supabase.from('lunch_votes').select('recommendation_id, user_id, vote_type').in('recommendation_id', recIds),
  ])

  const anonByUser = new Map<string, string>()
  ;(profilesRes.data ?? []).forEach((p: { user_id: string; anon_name: string | null }) => {
    anonByUser.set(p.user_id, (p.anon_name || '익명').trim() || '익명')
  })

  const wantCount: Record<string, number> = {}
  const unsureCount: Record<string, number> = {}
  const wtfCount: Record<string, number> = {}
  const myVote: Record<string, 'want' | 'unsure' | 'wtf'> = {}
  recIds.forEach((id) => {
    wantCount[id] = 0
    unsureCount[id] = 0
    wtfCount[id] = 0
  })
  ;(votesRes.data ?? []).forEach((v: { recommendation_id: string; user_id: string; vote_type: string }) => {
    if (v.vote_type === 'want') wantCount[v.recommendation_id] = (wantCount[v.recommendation_id] ?? 0) + 1
    else if (v.vote_type === 'unsure') unsureCount[v.recommendation_id] = (unsureCount[v.recommendation_id] ?? 0) + 1
    else if (v.vote_type === 'wtf') wtfCount[v.recommendation_id] = (wtfCount[v.recommendation_id] ?? 0) + 1
    if (userId && v.user_id === userId) {
      myVote[v.recommendation_id] = v.vote_type as 'want' | 'unsure' | 'wtf'
    }
  })

  const SCORE = { want: 2, unsure: 0, wtf: -1 }
  return recs.map((r) => {
    const want = wantCount[r.id] ?? 0
    const unsure = unsureCount[r.id] ?? 0
    const wtf = wtfCount[r.id] ?? 0
    const score = want * SCORE.want + unsure * SCORE.unsure + wtf * SCORE.wtf
    return {
      ...r,
      anon_name: anonByUser.get(r.user_id) ?? '익명',
      want_count: want,
      unsure_count: unsure,
      wtf_count: wtf,
      score,
      my_vote: userId ? myVote[r.id] ?? null : null,
    }
  })
}

/** 내가 이 라운드에 이미 추천한 건 하나 (호환용). */
export async function getMyRecommendationForRound(roundId: string, userId: string): Promise<LunchRecommendation | null> {
  const list = await getMyRecommendationsForRound(roundId, userId)
  return list[0] ?? null
}

/** 내가 이 라운드에 추천한 목록 (여러 건 가능). */
export async function getMyRecommendationsForRound(roundId: string, userId: string): Promise<LunchRecommendation[]> {
  const { data } = await supabase
    .from('lunch_recommendations')
    .select('id, round_id, user_id, restaurant_name, location, link_url, one_line_reason, created_at')
    .eq('round_id', roundId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return (data ?? []) as LunchRecommendation[]
}

/** 추천 제출. 1인 1라운드 여러 건 가능. */
export async function submitRecommendation(
  roundId: string,
  payload: { restaurant_name: string; location?: string; link_url?: string; one_line_reason: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('lunch_recommendations').insert({
    round_id: roundId,
    user_id: (await supabase.auth.getUser()).data.user?.id,
    restaurant_name: payload.restaurant_name.trim(),
    location: payload.location?.trim() || null,
    link_url: payload.link_url?.trim() || null,
    one_line_reason: payload.one_line_reason.trim(),
  })
  if (error) {
    if (error.code === '23505') {
      return { error: '아직 1인 1추천만 허용된 상태예요. 관리자가 여러 추천 허용 설정을 적용한 뒤 다시 시도해 주세요.' }
    }
    return { error: error.message }
  }
  return { error: null }
}

/** 투표: upsert (한 추천당 1표, 변경 가능). */
export async function setVote(
  recommendationId: string,
  voteType: 'want' | 'unsure' | 'wtf'
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요해요.' }
  const { error } = await supabase.from('lunch_votes').upsert(
    { recommendation_id: recommendationId, user_id: user.id, vote_type: voteType },
    { onConflict: 'recommendation_id,user_id' }
  )
  return { error: error ? error.message : null }
}

/** 특정 타임존 기준 어제 날짜 (YYYY-MM-DD). */
function getYesterdayRoundDate(tz: string): string {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const [y, m, d] = todayStr.split('-').map(Number)
  const yesterday = new Date(y, m - 1, d - 1)
  return yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0')
}

/** 마감이 지났는지 (서버 저장된 deadline_at은 이미 UTC이므로 클라이언트에서 비교 가능). */
export function isRoundPastDeadline(round: LunchRound): boolean {
  return new Date().getTime() >= new Date(round.deadline_at).getTime()
}

/** 어제(설정 타임존) 라운드 우승자 정보. */
export async function getYesterdayWinner(timezone?: string): Promise<YesterdayWinner | null> {
  const tz = timezone ?? (await fetchLunchSettings()).timezone
  const roundDate = getYesterdayRoundDate(tz)

  const { data: round } = await supabase
    .from('lunch_rounds')
    .select('id, winner_recommendation_id')
    .eq('round_date', roundDate)
    .maybeSingle()

  if (!round?.winner_recommendation_id) return null

  const { data: rec } = await supabase
    .from('lunch_recommendations')
    .select('id, user_id, restaurant_name, link_url')
    .eq('id', round.winner_recommendation_id)
    .single()
  if (!rec) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('anon_name')
    .eq('user_id', rec.user_id)
    .single()

  return {
    anon_name: (profile?.anon_name || '익명').trim() || '익명',
    restaurant_name: rec.restaurant_name,
    link_url: rec.link_url || null,
  }
}

/** 지난 7일(설정 타임존 기준) 점메추왕 메뉴 목록. round_date 내림차순. */
export async function getLast7DaysWinnerMenus(timezone?: string): Promise<Last7DaysWinnerEntry[]> {
  const tz = timezone ?? (await fetchLunchSettings()).timezone
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const [y, m, d] = todayStr.split('-').map(Number)
  const fromDate = new Date(y, m - 1, d - 6)
  const fromStr = fromDate.getFullYear() + '-' + String(fromDate.getMonth() + 1).padStart(2, '0') + '-' + String(fromDate.getDate()).padStart(2, '0')
  const { data: rounds } = await supabase
    .from('lunch_rounds')
    .select('round_date, winner_recommendation_id')
    .gte('round_date', fromStr)
    .not('winner_recommendation_id', 'is', null)
    .order('round_date', { ascending: false })
  if (!rounds?.length) return []
  const winnerRecIds = rounds.map((r) => r.winner_recommendation_id).filter(Boolean) as string[]
  const { data: recs } = await supabase
    .from('lunch_recommendations')
    .select('id, user_id, restaurant_name, link_url')
    .in('id', winnerRecIds)
  if (!recs?.length) return []
  const recById = new Map(recs.map((r) => [r.id, r]))
  const userIds = [...new Set(recs.map((r) => r.user_id))]
  const { data: profiles } = await supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds)
  const anonByUser = new Map<string, string>()
  ;(profiles ?? []).forEach((p: { user_id: string; anon_name: string | null }) => {
    anonByUser.set(p.user_id, (p.anon_name || '익명').trim() || '익명')
  })
  return rounds
    .map((r) => {
      const rec = r.winner_recommendation_id ? recById.get(r.winner_recommendation_id) : null
      if (!rec) return null
      return {
        round_date: r.round_date,
        restaurant_name: rec.restaurant_name,
        anon_name: anonByUser.get(rec.user_id) ?? '익명',
        link_url: rec.link_url || null,
      }
    })
    .filter((x): x is Last7DaysWinnerEntry => x != null)
}

/** 사용자 점메추 우승 횟수 (전체). */
export async function getLunchWinCount(userId: string): Promise<number> {
  const { data: rounds } = await supabase
    .from('lunch_rounds')
    .select('winner_recommendation_id')
    .not('winner_recommendation_id', 'is', null)
  const recIds = (rounds ?? []).map((r) => r.winner_recommendation_id).filter(Boolean) as string[]
  if (recIds.length === 0) return 0
  const { data: recs } = await supabase
    .from('lunch_recommendations')
    .select('id')
    .in('id', recIds)
    .eq('user_id', userId)
  return recs?.length ?? 0
}

export type HallOfFameEntry = { user_id: string; anon_name: string; win_count: number; avatar_url?: string | null; profile_color_index?: number | null }

/** 최근 7일 점메추 우승 횟수 상위 N명 (명예의 전당). */
export async function getLunchHallOfFame(limit = 10): Promise<HallOfFameEntry[]> {
  const tz = (await fetchLunchSettings()).timezone
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const [y, m, d] = todayStr.split('-').map(Number)
  const fromDate = new Date(y, m - 1, d - 6)
  const fromStr = fromDate.getFullYear() + '-' + String(fromDate.getMonth() + 1).padStart(2, '0') + '-' + String(fromDate.getDate()).padStart(2, '0')
  const { data: rounds } = await supabase
    .from('lunch_rounds')
    .select('id, winner_recommendation_id')
    .gte('round_date', fromStr)
    .not('winner_recommendation_id', 'is', null)
  const winnerRecIds = (rounds ?? []).map((r) => r.winner_recommendation_id).filter(Boolean) as string[]
  if (winnerRecIds.length === 0) return []
  const { data: recs } = await supabase
    .from('lunch_recommendations')
    .select('id, user_id')
    .in('id', winnerRecIds)
  const countByUser: Record<string, number> = {}
  ;(recs ?? []).forEach((r) => {
    countByUser[r.user_id] = (countByUser[r.user_id] ?? 0) + 1
  })
  const userIds = [...new Set(Object.keys(countByUser))]
  if (userIds.length === 0) return []
  const { data: profiles } = await supabase.from('profiles').select('user_id, anon_name, avatar_path, profile_color_index').in('user_id', userIds)
  const anonByUser = new Map<string, string>()
  const avatarByUser = new Map<string, string | null>()
  const colorIndexByUser = new Map<string, number | null>()
  ;(profiles ?? []).forEach((p: { user_id: string; anon_name: string | null; avatar_path: string | null; profile_color_index: number | null }) => {
    anonByUser.set(p.user_id, (p.anon_name || '익명').trim() || '익명')
    avatarByUser.set(p.user_id, getAvatarUrl(p.avatar_path))
    colorIndexByUser.set(p.user_id, p.profile_color_index ?? null)
  })
  return userIds
    .map((uid) => ({
      user_id: uid,
      anon_name: anonByUser.get(uid) ?? '익명',
      win_count: countByUser[uid] ?? 0,
      avatar_url: avatarByUser.get(uid) ?? null,
      profile_color_index: colorIndexByUser.get(uid) ?? null,
    }))
    .sort((a, b) => b.win_count - a.win_count)
    .slice(0, limit)
}
