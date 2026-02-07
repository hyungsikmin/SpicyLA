'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

export type ReactionType = 'laugh' | 'angry' | 'mindblown' | 'eyes' | 'chili'

const REACTIONS: { type: ReactionType; label: string; emoji: string }[] = [
  { type: 'laugh', label: '웃겨요', emoji: '🤣' },
  { type: 'angry', label: '화나요', emoji: '😡' },
  { type: 'mindblown', label: '헉', emoji: '🤯' },
  { type: 'eyes', label: '눈팅', emoji: '👀' },
  { type: 'chili', label: '고추', emoji: '🌶️' },
]

export type CountsByType = Record<ReactionType, number>

const defaultCounts: CountsByType = {
  laugh: 0,
  angry: 0,
  mindblown: 0,
  eyes: 0,
  chili: 0,
}

export default function ReactionButtons({
  postId,
  initialCounts,
  initialUserTypes,
  hasUser,
}: {
  postId: string
  initialCounts: CountsByType
  /** Types the current user has reacted with */
  initialUserTypes: ReactionType[]
  hasUser?: boolean
}) {
  const [counts, setCounts] = useState<CountsByType>({ ...defaultCounts, ...initialCounts })
  const [userTypes, setUserTypes] = useState<Set<ReactionType>>(new Set(initialUserTypes))
  const [loading, setLoading] = useState(false)

  const handleToggle = async (type: ReactionType) => {
    if (!hasUser) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setLoading(true)
    const had = userTypes.has(type)
    if (had) {
      const { error } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('reaction_type', type)
      if (!error) {
        setUserTypes((prev) => {
          const next = new Set(prev)
          next.delete(type)
          return next
        })
        setCounts((prev) => ({ ...prev, [type]: Math.max(0, (prev[type] ?? 0) - 1) }))
      }
    } else {
      const { error } = await supabase.from('post_reactions').insert({
        post_id: postId,
        user_id: user.id,
        reaction_type: type,
      })
      if (!error) {
        setUserTypes((prev) => new Set(prev).add(type))
        setCounts((prev) => ({ ...prev, [type]: (prev[type] ?? 0) + 1 }))
      } else if (error.code === '23505') {
        setUserTypes((prev) => new Set(prev).add(type))
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REACTIONS.map(({ type, label, emoji }) => {
        const count = counts[type] ?? 0
        const isActive = userTypes.has(type)
        return (
          <Button
            key={type}
            variant={isActive ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => handleToggle(type)}
            disabled={loading || !hasUser}
            className={
              isActive
                ? 'rounded-full gap-1.5 bg-muted text-foreground'
                : 'rounded-full gap-1.5'
            }
            title={hasUser ? label : '로그인하면 리액션할 수 있어요'}
          >
            <span>{emoji}</span>
            {count > 0 && (
              <span className="text-xs font-medium tabular-nums">{count}</span>
            )}
          </Button>
        )
      })}
    </div>
  )
}
