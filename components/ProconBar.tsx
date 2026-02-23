'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

export default function ProconBar({
  postId,
  proCount,
  conCount,
  userVote,
  currentUserId,
  compact,
  proLabel = '찬',
  conLabel = '반',
}: {
  postId: string
  proCount: number
  conCount: number
  userVote: 'pro' | 'con' | null
  currentUserId: string | null
  compact?: boolean
  proLabel?: string
  conLabel?: string
}) {
  const router = useRouter()
  const [voting, setVoting] = useState(false)
  const [optimisticSide, setOptimisticSide] = useState<'pro' | 'con' | null>(null)
  const effectivePro = proCount + (optimisticSide === 'pro' ? 1 : 0) - (userVote === 'pro' && optimisticSide !== null && optimisticSide !== 'pro' ? 1 : 0)
  const effectiveCon = conCount + (optimisticSide === 'con' ? 1 : 0) - (userVote === 'con' && optimisticSide !== null && optimisticSide !== 'con' ? 1 : 0)
  const effectiveVote = optimisticSide ?? userVote
  const total = effectivePro + effectiveCon
  const proPct = total > 0 ? Math.round((effectivePro / total) * 100) : 50
  const conPct = total > 0 ? 100 - proPct : 50
  const hasVoted = effectiveVote !== null

  useEffect(() => {
    if (optimisticSide != null && userVote !== null) setOptimisticSide(null)
  }, [userVote, optimisticSide])

  const handleVote = async (side: 'pro' | 'con') => {
    if (!currentUserId || voting) return
    setVoting(true)
    if (userVote === null) {
      const { error } = await supabase.from('post_procon_votes').insert({
        post_id: postId,
        user_id: currentUserId,
        side,
      })
      setVoting(false)
      if (!error) {
        setOptimisticSide(side)
        router.refresh()
      }
      return
    }
    const { error } = await supabase
      .from('post_procon_votes')
      .update({ side })
      .eq('post_id', postId)
      .eq('user_id', currentUserId)
    setVoting(false)
    if (!error) {
      setOptimisticSide(side)
      router.refresh()
    }
  }

  return (
    <div className={`rounded-xl border border-border bg-muted/30 ${compact ? 'p-2 mt-0' : 'p-3 mt-3'}`} role="region" aria-label="찬반 투표">
      {hasVoted ? (
        <>
          <div
            className={`flex rounded-full overflow-hidden border border-border bg-muted ${compact ? 'h-6' : 'h-8'}`}
            role="img"
            aria-label={`${proLabel} ${proPct}%, ${conLabel} ${conPct}%`}
          >
            <div
              className="flex items-center justify-center text-xs font-medium bg-emerald-500/80 text-white"
              style={{ width: `${proPct}%` }}
            >
              {proPct > 15 ? `${proLabel} ${proPct}%` : ''}
            </div>
            <div
              className="flex items-center justify-center text-xs font-medium bg-red-500/80 text-white"
              style={{ width: `${conPct}%` }}
            >
              {conPct > 15 ? `${conLabel} ${conPct}%` : ''}
            </div>
          </div>
          <p className={`text-xs text-muted-foreground ${compact ? 'mt-1' : 'mt-1.5'}`}>
            {proLabel} {proCount} · {conLabel} {conCount}
            {effectiveVote && (
              <span className="ml-1">(내 선택: {effectiveVote === 'pro' ? proLabel : conLabel})</span>
            )}
          </p>
        </>
      ) : (
        <div className={`flex gap-2 ${compact ? 'gap-1.5' : ''}`}>
          <Button
            type="button"
            variant="outline"
            className={`flex-1 bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 ${compact ? 'text-xs py-1.5 h-auto' : ''}`}
            disabled={!currentUserId || voting}
            onClick={() => handleVote('pro')}
            aria-label={`${proLabel}에 투표`}
          >
            {proLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={`flex-1 bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400 ${compact ? 'text-xs py-1.5 h-auto' : ''}`}
            disabled={!currentUserId || voting}
            onClick={() => handleVote('con')}
            aria-label={`${conLabel}에 투표`}
          >
            {conLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
