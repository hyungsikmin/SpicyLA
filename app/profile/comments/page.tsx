'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import RelativeTime from '@/components/RelativeTime'

type Row = { id: string; body: string; created_at: string; post_id: string }

export default function MyCommentsPage() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/login?from=/profile/comments'
        return
      }
      setUser(data.user)
      supabase.from('comments').select('id, body, created_at, post_id').eq('user_id', data.user.id).order('created_at', { ascending: false }).then(({ data: list }) => {
        setRows((list as Row[]) ?? [])
        setLoading(false)
      })
    })
  }, [])

  if (!user) return null
  return (
    <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" asChild><Link href="/profile">←</Link></Button>
        <h1 className="text-lg font-semibold">내가 쓴 댓글</h1>
      </header>
      {loading && <p className="p-4 text-muted-foreground text-sm">로딩 중…</p>}
      {!loading && rows.length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">아직 작성한 댓글이 없어요.</p>}
      {!loading && rows.length > 0 && (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/p/${r.post_id}#c-${r.id}`} className="block px-4 py-3 hover:bg-muted/30">
                <p className="text-sm line-clamp-2">{r.body}</p>
                <p className="text-muted-foreground text-xs mt-0.5"><RelativeTime date={r.created_at} /></p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
