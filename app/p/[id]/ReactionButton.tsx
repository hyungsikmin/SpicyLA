'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

const LEVELS = ['😏', '😰', '🥵', '🌶️'] as const
function getLevel(count: number): 1 | 2 | 3 | 4 {
  if (count >= 4) return 4
  if (count >= 3) return 3
  if (count >= 2) return 2
  return 1
}

export default function ReactionButton({
  postId,
  initialCount,
  initialUserReacted,
  hasUser = true,
}: {
  postId: string
  initialCount: number
  initialUserReacted: boolean
  hasUser?: boolean
}) {
  const [count, setCount] = useState(initialCount)
  const [userReacted, setUserReacted] = useState(initialUserReacted)
  const [loading, setLoading] = useState(false)
  const level = getLevel(count)

  const handleClick = async () => {
    if (userReacted || !hasUser || loading) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setLoading(true)
    setUserReacted(true)
    setCount((c) => c + 1)
    const { error } = await supabase.from('post_reactions').insert({
      post_id: postId,
      user_id: user.id,
    })
    setLoading(false)
    if (error && error.code !== '23505') {
      setUserReacted(false)
      setCount(initialCount)
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-3 flex-wrap justify-start">
        <Button
          variant={userReacted ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={handleClick}
          disabled={loading || userReacted || !hasUser}
          className={
            userReacted
              ? 'bg-muted text-muted-foreground cursor-default'
              : ''
          }
          title={userReacted ? '리액션함' : hasUser ? '리액션' : '로그인하면 리액션할 수 있어요'}
        >
          🌶️
        </Button>
        <div className="flex-1 min-w-[120px] flex flex-col gap-1">
          <div className="flex items-center justify-between gap-0.5 text-sm">
            {LEVELS.map((emoji, i) => (
              <span
                key={emoji}
                className={`shrink-0 ${i + 1 <= level ? 'opacity-100' : 'opacity-40'}`}
                title={`레벨 ${i + 1}`}
              >
                {emoji}
              </span>
            ))}
          </div>
          <div
            className="w-full h-2 rounded-sm overflow-hidden relative"
            style={{
              clipPath: 'polygon(0 60%, 5% 20%, 95% 20%, 100% 60%, 95% 100%, 5% 100%)',
              background: 'linear-gradient(90deg, #22c55e 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #ef4444 100%)',
              opacity: 0.35,
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-sm transition-[width] duration-300"
              style={{
                width: `${(level / 4) * 100}%`,
                background: 'linear-gradient(90deg, #22c55e 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #ef4444 100%)',
                opacity: 1,
              }}
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        🌶️ {count}
      </p>
    </div>
  )
}
