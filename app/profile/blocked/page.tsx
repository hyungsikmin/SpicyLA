'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

type BlockedRow = { blocked_id: string; anon_name: string | null }

export default function BlockedPage() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [list, setList] = useState<BlockedRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/login?from=/profile/blocked'
        return
      }
      setUser(data.user)
    })
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const load = async () => {
      const { data: rows } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)
      if (!rows?.length) {
        setList([])
        setLoading(false)
        return
      }
      const ids = rows.map((r) => r.blocked_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, anon_name')
        .in('user_id', ids)
      const nameByUserId: Record<string, string | null> = {}
      profiles?.forEach((p) => {
        nameByUserId[p.user_id] = p.anon_name?.trim() || null
      })
      setList(
        ids.map((blocked_id) => ({
          blocked_id,
          anon_name: nameByUserId[blocked_id] ?? null,
        }))
      )
      setLoading(false)
    }
    load()
  }, [user?.id])

  const unblock = async (blockedId: string) => {
    if (!user) return
    await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', blockedId)
    setList((prev) => prev.filter((r) => r.blocked_id !== blockedId))
  }

  if (!user) return null
  return (
    <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" asChild><Link href="/profile">←</Link></Button>
        <h1 className="text-lg font-semibold">차단 관리</h1>
      </header>
      {loading && <p className="p-8 text-center text-muted-foreground text-sm">로딩 중…</p>}
      {!loading && list.length === 0 && (
        <p className="p-8 text-center text-muted-foreground text-sm">차단한 사용자가 없어요.</p>
      )}
      {!loading && list.length > 0 && (
        <ul className="divide-y divide-border">
          {list.map((row) => (
            <li key={row.blocked_id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium text-sm">{row.anon_name || '익명'}</span>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => unblock(row.blocked_id)}>
                차단 해제
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
