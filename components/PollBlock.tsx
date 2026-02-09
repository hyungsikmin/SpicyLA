'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

function getCountdown(endsAt: string): string {
  const deadline = new Date(endsAt).getTime()
  const now = Date.now()
  const left = Math.max(0, deadline - now)
  if (left <= 0) return '마감됨'
  const h = Math.floor(left / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  const s = Math.floor((left % 60000) / 1000)
  if (h > 0) return `${h}시간 ${m}분 ${s}초 남음`
  if (m > 0) return `${m}분 ${s}초 남음`
  return `${s}초 남음`
}

export type PollData = {
  id: string
  post_id: string
  question: string
  option_1: string
  option_2: string
  option_3: string | null
  option_4: string | null
  ends_at: string | null
}

const OPTION_KEYS = ['option_1', 'option_2', 'option_3', 'option_4'] as const

export default function PollBlock({
  poll,
  counts,
  userVoteIndex,
  postUserId,
  currentUserId,
  compact,
}: {
  poll: PollData
  counts: number[]
  userVoteIndex: number | null
  postUserId: string
  currentUserId: string | null
  compact?: boolean
}) {
  const router = useRouter()
  const [voting, setVoting] = useState(false)
  const [optimisticOptionIndex, setOptimisticOptionIndex] = useState<number | null>(null)
  const options = OPTION_KEYS.map((key) => poll[key]).filter(Boolean) as string[]
  const effectiveVoteIndex = optimisticOptionIndex ?? userVoteIndex
  const effectiveCounts = optimisticOptionIndex != null
    ? counts.map((c, i) => c + (i === optimisticOptionIndex ? 1 : 0))
    : counts
  const total = effectiveCounts.reduce((a, b) => a + b, 0)
  const isCreator = currentUserId === postUserId
  const ended = poll.ends_at ? new Date(poll.ends_at) <= new Date() : false
  const canVote = !!currentUserId && !isCreator && !ended && effectiveVoteIndex === null

  useEffect(() => {
    if (optimisticOptionIndex != null && userVoteIndex !== null) setOptimisticOptionIndex(null)
  }, [userVoteIndex, optimisticOptionIndex])

  const handleVote = async (optionIndex: number) => {
    if (!currentUserId || voting || !canVote) return
    setVoting(true)
    const { error } = await supabase.from('post_poll_votes').insert({
      post_id: poll.post_id,
      user_id: currentUserId,
      option_index: optionIndex,
    })
    setVoting(false)
    if (!error) {
      setOptimisticOptionIndex(optionIndex)
      router.refresh()
    }
  }

  const showResults = effectiveVoteIndex !== null || ended || isCreator
  const [countdown, setCountdown] = useState<string | null>(() =>
    poll.ends_at && !ended ? getCountdown(poll.ends_at) : null
  )
  useEffect(() => {
    if (!poll.ends_at || ended) {
      setCountdown(null)
      return
    }
    const update = () => {
      const next = getCountdown(poll.ends_at!)
      setCountdown(next)
      if (next === '마감됨') setCountdown(null)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [poll.ends_at, ended])

  return (
    <div className={`rounded-xl border border-border bg-muted/30 ${compact ? 'p-2 mt-0' : 'p-3 mt-3'}`} role="region" aria-label="투표">
      <p id="poll-question" className={`font-medium text-foreground ${compact ? 'text-xs mb-1' : 'text-sm mb-2'}`}>{poll.question}</p>
      {showResults ? (
        <ul className={compact ? 'space-y-1' : 'space-y-2'} aria-label="투표 결과">
          {options.map((label, i) => {
            const count = effectiveCounts[i] ?? 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            const isUserChoice = effectiveVoteIndex === i
            const maxCount = options.length > 0 ? Math.max(...options.map((_, idx) => effectiveCounts[idx] ?? 0)) : 0
            const isWinningBar = total > 0 && count === maxCount && count > 0
            return (
              <li key={i}>
                <div className={`flex items-center justify-between gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
                  <span className={isUserChoice ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                    {label} {isUserChoice && '(내 선택)'}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{pct}%</span>
                </div>
                <div className={`${compact ? 'h-1.5' : 'h-2'} mt-0.5 rounded-full bg-muted overflow-hidden`}>
                  <div
                    className={`h-full rounded-full transition-all ${isWinningBar ? 'bg-red-500/80' : 'bg-primary/70'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
          {options.map((label, i) => (
            <Button
              key={i}
              type="button"
              variant="outline"
              className={`w-full justify-start font-normal ${compact ? 'text-xs py-1.5 h-auto' : 'text-sm'}`}
              disabled={voting}
              onClick={() => handleVote(i)}
              aria-label={`${label} 선택`}
              aria-describedby="poll-question"
            >
              {label}
            </Button>
          ))}
        </div>
      )}
      {poll.ends_at && !ended && countdown && (
        <p className={`text-xs text-muted-foreground tabular-nums ${compact ? 'mt-1' : 'mt-2'}`} aria-live="polite">
          {countdown}
        </p>
      )}
    </div>
  )
}
