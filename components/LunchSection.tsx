'use client'

import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  fetchLunchSettings,
  getOrCreateTodayRound,
  fetchRecommendationsWithMeta,
  getMyRecommendationsForRound,
  submitRecommendation,
  setVote,
  getYesterdayWinner,
  getLast7DaysWinnerMenus,
  getLunchHallOfFame,
  isRoundPastDeadline,
  type LunchRound,
  type LunchSettings,
  type RecommendationWithMeta,
  type YesterdayWinner,
  type Last7DaysWinnerEntry,
  type HallOfFameEntry,
} from '@/lib/lunch'
import { ChevronDown, ChevronUp, Crown, ExternalLink } from 'lucide-react'
import { userAvatarEmoji } from '@/lib/postAvatar'
import { getAvatarColorClass } from '@/lib/avatarColors'

const VOTE_LABELS: Record<string, string> = { want: '가고싶다', unsure: '애매', wtf: '뭐야이건' }

/** 지난 5일 날짜 (오늘 제외, 1일전~5일전) */
function getLast5RoundDates(): string[] {
  const out: string[] = []
  for (let i = 1; i <= 5; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}
const DUMMY_LAST5_RESTAURANTS = [
  { restaurant_name: 'BCD Tofu House', anon_name: '익명의왕' },
  { restaurant_name: 'Kang Ho-dong Baekjeong', anon_name: '맛집러버' },
  { restaurant_name: 'Sun Nong Dan', anon_name: '치즈폭포' },
  { restaurant_name: 'Hae Jang Chon', anon_name: '고기덕후' },
  { restaurant_name: 'Myung Dong Kyoja', anon_name: '칼국수' },
]
function getDummyLast5Winners(): Last7DaysWinnerEntry[] {
  const dates = getLast5RoundDates()
  return dates.map((round_date, i) => ({
    round_date,
    restaurant_name: DUMMY_LAST5_RESTAURANTS[i]?.restaurant_name ?? '맛집',
    anon_name: DUMMY_LAST5_RESTAURANTS[i]?.anon_name ?? '익명',
    link_url: null,
  }))
}
const DUMMY_HALL_OF_FAME: HallOfFameEntry[] = [
  { user_id: 'dummy-1', anon_name: '점메추왕', win_count: 5 },
  { user_id: 'dummy-2', anon_name: '맛집탐험가', win_count: 3 },
  { user_id: 'dummy-3', anon_name: '오늘뭐먹지', win_count: 2 },
]

function formatRoundDate(roundDate: string): string {
  const [y, m, d] = roundDate.split('-').map(Number)
  const dObj = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dObj.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - dObj.getTime()) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff >= 2 && diff <= 6) return `${m}/${d}`
  return `${m}/${d}`
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']
function formatRoundDateShort(roundDate: string): string {
  const [y, m, d] = roundDate.split('-').map(Number)
  const dObj = new Date(y, m - 1, d)
  return `${m}/${d} ${WEEKDAY_KO[dObj.getDay()]}`
}

function LunchEntryCard({
  recommendation,
  isWinner,
  isLeading,
  onOpenModal,
}: {
  recommendation: RecommendationWithMeta
  isWinner: boolean
  isLeading: boolean
  onOpenModal: () => void
}) {
  const { restaurant_name, one_line_reason, link_url, want_count, unsure_count, wtf_count } = recommendation
  const href = link_url?.trim() ? (link_url.startsWith('http') ? link_url : `https://${link_url}`) : null
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !href) return null
    try {
      return localStorage.getItem(`lunch_og:${href}`) || null
    } catch {
      return null
    }
  })
  const [ogImageFailed, setOgImageFailed] = useState(false)
  useEffect(() => {
    if (!href) {
      setOgImageUrl(null)
      setOgImageFailed(false)
      return
    }
    try {
      const cached = localStorage.getItem(`lunch_og:${href}`)
      if (cached) {
        setOgImageUrl(cached)
        setOgImageFailed(false)
        return
      }
    } catch {
      /* ignore */
    }
    setOgImageUrl(null)
    setOgImageFailed(false)
    const encoded = encodeURIComponent(href)
    fetch(`/api/og?url=${encoded}`)
      .then((r) => r.json())
      .then((data: { imageUrl?: string | null }) => {
        if (data.imageUrl) {
          setOgImageUrl(data.imageUrl)
          try {
            localStorage.setItem(`lunch_og:${href}`, data.imageUrl)
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => setOgImageFailed(true))
  }, [href])
  const showDummy = !ogImageUrl || ogImageFailed
  const imageLoading = !!href && !ogImageUrl && !ogImageFailed
  return (
    <button
      type="button"
      onClick={onOpenModal}
      className={`text-left rounded-xl overflow-hidden transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500/50 flex flex-row ${
        isWinner ? 'border-2 border-amber-500/60 bg-amber-500/10' : 'border-border bg-card hover:bg-muted/30'
      }`}
    >
      <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-medium text-foreground text-sm truncate">{restaurant_name}</p>
          {isWinner && (
            <span className="shrink-0 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/25 px-2 py-0.5 rounded-md ring-1 ring-amber-500/40 animate-pulse">
              오늘의 PICK
            </span>
          )}
        </div>
        {one_line_reason && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{one_line_reason}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          🔥 {want_count} · 🤔 {unsure_count} · 😂 {wtf_count}
        </p>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 hover:underline"
          >
            링크 <ExternalLink className="size-2.5" />
          </a>
        )}
      </div>
      <div className="relative w-28 shrink-0 aspect-square bg-muted overflow-hidden" aria-hidden>
        {imageLoading ? (
          <div className="absolute inset-0 bg-muted-foreground/10 animate-pulse" aria-hidden />
        ) : showDummy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-400/20 to-orange-300/10 dark:from-amber-500/15 dark:to-orange-400/10">
            <span className="text-xl opacity-80">🍽️</span>
          </div>
        ) : (
          <img
            key={ogImageUrl ?? 'img'}
            src={ogImageUrl!}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setOgImageFailed(true)}
          />
        )}
      </div>
    </button>
  )
}

export default function LunchSection({
  user,
  hallOfFame: hallOfFameProp,
  feedAvatarMap,
}: {
  user: User | null
  hallOfFame?: HallOfFameEntry[]
  feedAvatarMap?: Record<string, string>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const userRef = useRef<User | null>(null)
  userRef.current = user

  const [lunchSettings, setLunchSettings] = useState<LunchSettings | null>(null)
  const [todayRound, setTodayRound] = useState<LunchRound | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationWithMeta[]>([])
  const [myRecs, setMyRecs] = useState<{ restaurant_name: string }[]>([])
  const [yesterdayWinner, setYesterdayWinner] = useState<YesterdayWinner | null>(null)
  const [last7DaysWinners, setLast7DaysWinners] = useState<Last7DaysWinnerEntry[]>([])
  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [showAllLunchRecs, setShowAllLunchRecs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [votingId, setVotingId] = useState<string | null>(null)
  const LUNCH_REC_PREVIEW = 3

  // 마운트 시 한 번만 실행. user 변경 시 라운드 재조회하지 않아서
  // "12시→19시→결과"처럼 두 번째 로드가 첫 결과를 덮어쓰는 현상 제거.
  const load = useCallback(async () => {
    const settings = await fetchLunchSettings()
    setLunchSettings(settings)
    const round = await getOrCreateTodayRound(settings)
    if (!round) return
    const uid = userRef.current?.id
    const [recs, winner, last7, hof] = await Promise.all([
      fetchRecommendationsWithMeta(round.id, uid ?? undefined),
      getYesterdayWinner(settings.timezone),
      getLast7DaysWinnerMenus(settings.timezone),
      getLunchHallOfFame(10),
    ])
    setTodayRound(round)
    setRecommendations(recs)
    setYesterdayWinner(winner)
    setLast7DaysWinners(last7)
    setHallOfFame(hof)
    if (uid) {
      const list = await getMyRecommendationsForRound(round.id, uid)
      setMyRecs(list.map((r) => ({ restaurant_name: r.restaurant_name })))
    } else {
      setMyRecs([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // user만 바뀐 경우: 라운드/설정은 그대로 두고 myRecs와 추천 목록(내 투표 반영)만 갱신
  useEffect(() => {
    if (!todayRound) return
    if (user) {
      getMyRecommendationsForRound(todayRound.id, user.id).then((list) =>
        setMyRecs(list.map((r) => ({ restaurant_name: r.restaurant_name })))
      )
      fetchRecommendationsWithMeta(todayRound.id, user.id).then(setRecommendations)
    } else {
      setMyRecs([])
      fetchRecommendationsWithMeta(todayRound.id, undefined).then(setRecommendations)
    }
  }, [user?.id, todayRound?.id])

  useEffect(() => {
    if (modalOpen && todayRound) {
      fetchRecommendationsWithMeta(todayRound.id, user?.id).then(setRecommendations)
      if (user) {
        getMyRecommendationsForRound(todayRound.id, user.id).then((list) =>
          setMyRecs(list.map((r) => ({ restaurant_name: r.restaurant_name })))
        )
      }
    }
  }, [modalOpen, todayRound?.id, user?.id])

  const isClosed = todayRound?.status === 'closed'
  const pastDeadline = todayRound ? isRoundPastDeadline(todayRound) : false
  const canSubmit = !isClosed && !pastDeadline
  const participantCount = recommendations.length
  const winnerRec = isClosed && recommendations.length > 0
    ? recommendations.reduce((a, b) => (b.score > a.score ? b : a))
    : null
  const roundReady = todayRound !== null

  // 마감까지 남은 시간 (오픈 라운드일 때만, 1초마다 갱신)
  const [countdown, setCountdown] = useState<string | null>(null)
  useEffect(() => {
    if (!todayRound || isClosed) {
      setCountdown(null)
      return
    }
    const deadline = new Date(todayRound.deadline_at).getTime()
    const update = () => {
      const now = Date.now()
      const left = Math.max(0, deadline - now)
      if (left <= 0) {
        setCountdown('마감됨')
        return
      }
      const h = Math.floor(left / 3600000)
      const m = Math.floor((left % 3600000) / 60000)
      const s = Math.floor((left % 60000) / 1000)
      if (h > 0) setCountdown(`${h}시간 ${m}분 ${s}초 남음`)
      else if (m > 0) setCountdown(`${m}분 ${s}초 남음`)
      else setCountdown(`${s}초 남음`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [todayRound?.id, todayRound?.deadline_at, isClosed])

  const deadlineLabel = lunchSettings ? `${lunchSettings.deadline_hour}:00까지` : '…까지'
  const showCountdown = roundReady && !isClosed && countdown !== null
  const handleParticipateClick = () => {
    if (!user) {
      router.push('/login?from=' + encodeURIComponent(pathname ?? '/'))
      return
    }
    setModalOpen(true)
  }

  return (
    <>
      <section className="rounded-t-xl -mt-3 px-4 py-5 bg-gradient-to-b from-amber-500/10 to-transparent dark:from-amber-500/8 dark:to-transparent" aria-label="오늘의 점메추">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 min-w-0">
            <span className="shrink-0 size-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400" aria-hidden>
              🍱
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground leading-tight">
                {!roundReady ? '오늘의 점메추' : isClosed ? '오늘의 점메추 결과' : '오늘의 점메추'}
              </h2>
            {showCountdown && (
              <span
                className="inline-flex items-center rounded-full bg-amber-500/25 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 animate-pulse mt-1.5"
                aria-live="polite"
              >
                {countdown}
              </span>
            )}
            {roundReady && !isClosed && !showCountdown && (
              <p className="text-xs text-muted-foreground mt-0.5">{deadlineLabel}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {!roundReady ? '불러오는 중…' : isClosed ? `참여 ${participantCount}명` : `현재 참여 ${participantCount}명`}
            </p>
            </div>
          </div>
          {roundReady && !isClosed && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 shrink-0"
              onClick={handleParticipateClick}
              aria-label="점메추 참여하기 또는 투표하기"
            >
              참여하기
            </Button>
          )}
        </div>

        {!roundReady && (
          <p className="text-sm text-muted-foreground">잠시만 기다려 주세요.</p>
        )}

        {roundReady && (
          <>
            <p className="text-muted-foreground text-xs font-medium mb-2 mt-3 w-full">오늘의 추천</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* 왼쪽: 어제 우승 + 카드 스택 + 더보기 + 점메추왕 + 참여하기 */}
              <div className="space-y-3 order-1 min-w-0 w-full flex flex-col items-center">
                {yesterdayWinner && (
                  <div className="w-full rounded-lg bg-card/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">어제 우승: </span>
                    <span className="font-medium text-foreground">{yesterdayWinner.anon_name} 추천 </span>
                    {yesterdayWinner.link_url ? (
                      <a href={yesterdayWinner.link_url.startsWith('http') ? yesterdayWinner.link_url : `https://${yesterdayWinner.link_url}`} target="_blank" rel="noopener noreferrer" className="text-foreground underline inline-flex items-center gap-0.5">
                        {yesterdayWinner.restaurant_name}
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <span className="text-foreground">{yesterdayWinner.restaurant_name}</span>
                    )}
                  </div>
                )}

                {recommendations.length > 0 ? (() => {
                  const visible = showAllLunchRecs ? recommendations : recommendations.slice(0, LUNCH_REC_PREVIEW)
                  const hasMore = recommendations.length > LUNCH_REC_PREVIEW
                  return (
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full max-w-lg flex flex-col gap-1.5 mx-auto">
                        {visible.map((r) => (
                          <LunchEntryCard
                            key={r.id}
                            recommendation={r}
                            isWinner={isClosed && winnerRec?.id === r.id}
                            isLeading={false}
                            onOpenModal={() => setModalOpen(true)}
                          />
                        ))}
                      </div>
                      {hasMore && (
                        <button
                          type="button"
                          className="mt-2 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                          onClick={() => setShowAllLunchRecs((v) => !v)}
                          aria-label={showAllLunchRecs ? '접기' : `더 보기 (${recommendations.length - LUNCH_REC_PREVIEW}개 더)`}
                        >
                          {showAllLunchRecs ? (
                            <ChevronUp className="size-6 mx-auto" aria-hidden />
                          ) : (
                            <ChevronDown className="size-6 mx-auto" aria-hidden />
                          )}
                        </button>
                      )}
                    </div>
                  )
                })() : (
                  <div className="w-full rounded-lg border border-border bg-card/50 px-3 py-3 text-sm text-muted-foreground">
                    <p className="text-xs">아직 추천이 없어요. 첫 추천을 남겨 보세요!</p>
                  </div>
                )}

            </div>

              {/* 오른쪽: 명예의 전당(3명) + 지난 5일 */}
              <div className="space-y-3 order-2 min-w-0">
                <div className="rounded-xl border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/15 to-amber-500/5 px-3 py-3 text-sm">
                  <p className="text-amber-700 dark:text-amber-300 text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <span aria-hidden>🏆</span> 명예의 전당
                  </p>
                  <ul className="space-y-2">
                    {((hallOfFameProp?.length ? hallOfFameProp : hallOfFame.length > 0 ? hallOfFame : DUMMY_HALL_OF_FAME)).slice(0, 3).map((entry, i) => {
                      const avatarUrl = feedAvatarMap?.[entry.user_id] ?? ('avatar_url' in entry ? entry.avatar_url : null)
                      return (
                      <li key={entry.user_id + String(i)} className="flex items-center gap-2.5">
                        <span className="relative shrink-0">
                          <span className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 text-amber-600 dark:text-amber-400">
                            <Crown className="size-3.5" aria-hidden />
                          </span>
                          <span className={`relative flex h-8 w-8 items-center justify-center rounded-full overflow-hidden text-lg ${avatarUrl ? 'bg-amber-500/25 text-amber-700 dark:text-amber-300' : getAvatarColorClass('profile_color_index' in entry ? entry.profile_color_index ?? null : null, entry.user_id)}`}>
                            {avatarUrl ? (
                              <img key={avatarUrl} src={avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <span aria-hidden>{userAvatarEmoji(entry.user_id)}</span>
                            )}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">{entry.anon_name}</span>
                        <span className="shrink-0 rounded-full bg-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          {entry.win_count}승
                        </span>
                      </li>
                    )})}
                  </ul>
                </div>
<div className="rounded-lg bg-card/50 px-3 py-2 text-sm">
                <p className="text-muted-foreground text-xs font-medium mb-1.5">지난 5일 점메추 1위</p>
                  <ul className="space-y-1 text-xs">
                    {(last7DaysWinners.length > 0
                      ? last7DaysWinners.filter((e) => e.round_date !== todayRound?.round_date).slice(0, 5)
                      : getDummyLast5Winners()
                    ).map((entry, idx) => {
                      const dateLabel = formatRoundDateShort(entry.round_date)
                      const roundHref = `${pathname ?? '/'}?lunch_date=${entry.round_date}`
                      return (
                        <li key={entry.round_date + String(idx)}>
                          <a
                            href={roundHref}
                            className="flex items-center gap-1.5 truncate rounded hover:bg-muted/50 transition-colors py-0.5 -mx-1 px-1"
                          >
                            <span className="shrink-0 text-muted-foreground">{dateLabel}</span>
                            <span className="text-foreground truncate min-w-0 flex-1">{entry.restaurant_name}</span>
                            <span className="shrink-0 text-muted-foreground">({entry.anon_name})</span>
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <LunchModal
          user={user}
          round={todayRound}
          recommendations={recommendations}
          myRecs={myRecs}
          isClosed={isClosed}
          pastDeadline={pastDeadline}
          onClose={() => { setModalOpen(false); setSubmitError(null) }}
          onSuccess={load}
          submitting={submitting}
          setSubmitting={setSubmitting}
          submitError={submitError}
          setSubmitError={setSubmitError}
          votingId={votingId}
          setVotingId={setVotingId}
        />
      )}
    </>
  )
}

function LunchModal({
  user,
  round,
  recommendations,
  myRecs,
  isClosed,
  pastDeadline,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
  submitError,
  setSubmitError,
  votingId,
  setVotingId,
}: {
  user: User | null
  round: LunchRound | null
  recommendations: RecommendationWithMeta[]
  myRecs: { restaurant_name: string }[]
  isClosed: boolean
  pastDeadline: boolean
  onClose: () => void
  onSuccess: () => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
  submitError: string | null
  setSubmitError: (v: string | null) => void
  votingId: string | null
  setVotingId: (v: string | null) => void
}) {
  const [restaurantName, setRestaurantName] = useState('')
  const [location, setLocation] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [oneLineReason, setOneLineReason] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !round || round.status !== 'open') return
    setSubmitError(null)
    setSubmitting(true)
    const { error } = await submitRecommendation(round.id, {
      restaurant_name: restaurantName,
      location: location || undefined,
      link_url: linkUrl || undefined,
      one_line_reason: oneLineReason,
    })
    setSubmitting(false)
    if (error) {
      setSubmitError(error)
      return
    }
    setRestaurantName('')
    setLocation('')
    setLinkUrl('')
    setOneLineReason('')
    onSuccess()
  }

  const handleVote = async (recommendationId: string, voteType: 'want' | 'unsure' | 'wtf') => {
    if (!user || isClosed) return
    setVotingId(recommendationId)
    await setVote(recommendationId, voteType)
    setVotingId(null)
    onSuccess()
  }

  if (!round) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-background border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <h2 className="text-lg font-semibold">오늘의 점메추</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="닫기">닫기</Button>
        </div>
        <div className="p-4 space-y-4">
          {!user && (
            <p className="text-sm text-muted-foreground">로그인하면 참여하고 투표할 수 있어요.</p>
          )}

          {user && !isClosed && !pastDeadline && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="lunch-restaurant" className="block text-xs text-muted-foreground mb-1">레스토랑 이름 *</label>
                <input
                  id="lunch-restaurant"
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="예: BCD Tofu House"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  required
                />
              </div>
              <div>
                <label htmlFor="lunch-location" className="block text-xs text-muted-foreground mb-1">위치 (선택)</label>
                <input
                  id="lunch-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="예: Ktown"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label htmlFor="lunch-link" className="block text-xs text-muted-foreground mb-1">Yelp/Google 링크 (선택)</label>
                <input
                  id="lunch-link"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label htmlFor="lunch-reason" className="block text-xs text-muted-foreground mb-1">한줄 이유 *</label>
                <input
                  id="lunch-reason"
                  type="text"
                  value={oneLineReason}
                  onChange={(e) => setOneLineReason(e.target.value)}
                  placeholder="예: 두부찌개가 진해요"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  required
                />
              </div>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              <Button type="submit" size="sm" className="rounded-full w-full" disabled={submitting}>
                {submitting ? '제출 중…' : myRecs.length > 0 ? '추가로 추천하기' : '참여하기'}
              </Button>
            </form>
          )}
          {user && myRecs.length > 0 && !isClosed && (
            <p className="text-sm text-muted-foreground">이미 {myRecs.length}개 추천했어요. 아래에서 투표도 해 보세요!</p>
          )}
          {pastDeadline && !isClosed && (
            <p className="text-sm text-muted-foreground">마감 시간이 지나 새 추천은 받지 않아요. 결과는 곧 반영됩니다.</p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">추천 목록</h3>
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 추천이 없어요.</p>
            ) : (
              <ul className="space-y-3">
                {recommendations.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{r.restaurant_name}</p>
                        {r.location && <p className="text-xs text-muted-foreground">{r.location}</p>}
                        <p className="text-sm text-muted-foreground mt-0.5">{r.one_line_reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">익명-{r.anon_name}</p>
                        {r.link_url && (
                          <a href={r.link_url.startsWith('http') ? r.link_url : `https://${r.link_url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1">
                            링크 <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                      {isClosed ? (
                        <div className="text-right shrink-0 text-xs text-muted-foreground">
                          <span className="text-amber-600 dark:text-amber-400 font-medium">🔥 {r.want_count}</span>
                          <span className="mx-1">·</span>
                          <span>🤔 {r.unsure_count}</span>
                          <span className="mx-1">·</span>
                          <span>🤣 {r.wtf_count}</span>
                          <p className="font-medium text-foreground mt-0.5">점수 {r.score}</p>
                        </div>
                      ) : user && (
                        <div className="flex flex-col gap-1 shrink-0">
                          {(['want', 'unsure', 'wtf'] as const).map((voteType) => {
                            const isSelected = r.my_vote === voteType
                            const selectedClass =
                              voteType === 'want'
                                ? 'bg-amber-500/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/50'
                                : voteType === 'unsure'
                                ? 'bg-sky-500/25 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/50'
                                : 'bg-purple-500/25 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500/50'
                            return (
                              <button
                                key={voteType}
                                type="button"
                                disabled={votingId === r.id}
                                onClick={() => handleVote(r.id, voteType)}
                                className={`rounded-full px-2 py-1 text-xs font-medium transition-colors ${
                                  isSelected ? selectedClass : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                }`}
                                aria-pressed={isSelected}
                                aria-label={VOTE_LABELS[voteType]}
                              >
                                {voteType === 'want' && '🔥'}
                                {voteType === 'unsure' && '🤔'}
                                {voteType === 'wtf' && '🤣'} {VOTE_LABELS[voteType]}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
