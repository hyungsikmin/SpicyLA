'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import RelativeTime from '@/components/RelativeTime'
import { MessageCircle, Eye } from 'lucide-react'

type Post = { id: string; title: string | null; body: string; created_at: string }

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return Math.abs(h)
}
function postFakeViews(postId: string, comments: number, reactions: number) {
  return (hashStr(postId) % 400) + 50 + comments * 3 + reactions * 2
}

export default function MyPostsPage() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/login?from=/profile/posts'
        return
      }
      setUser(data.user)
      supabase.from('posts').select('id, title, body, created_at').eq('user_id', data.user.id).order('created_at', { ascending: false }).then(async ({ data: list }) => {
        const postList = (list as Post[]) ?? []
        setPosts(postList)
        if (postList.length === 0) {
          setLoading(false)
          return
        }
        const ids = postList.map((p) => p.id)
        const [reactionsRes, commentsRes] = await Promise.all([
          supabase.from('post_reactions').select('post_id').in('post_id', ids),
          supabase.from('comments').select('post_id').in('post_id', ids),
        ])
        const rc: Record<string, number> = {}
        const cc: Record<string, number> = {}
        ids.forEach((id) => { rc[id] = 0; cc[id] = 0 })
        ;(reactionsRes.data ?? []).forEach((r: { post_id: string }) => { rc[r.post_id] = (rc[r.post_id] ?? 0) + 1 })
        ;(commentsRes.data ?? []).forEach((c: { post_id: string }) => { cc[c.post_id] = (cc[c.post_id] ?? 0) + 1 })
        setReactionCounts(rc)
        setCommentCounts(cc)
        setLoading(false)
      })
    })
  }, [])

  if (!user) return null
  return (
    <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" asChild><Link href="/profile">←</Link></Button>
        <h1 className="text-lg font-semibold">내가 쓴 글</h1>
      </header>
      {loading && <p className="p-4 text-muted-foreground text-sm">로딩 중…</p>}
      {!loading && posts.length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">아직 작성한 글이 없어요.</p>}
      {!loading && posts.length > 0 && (
        <ul className="divide-y divide-border">
          {posts.map((p) => {
            const comments = commentCounts[p.id] ?? 0
            const reactions = reactionCounts[p.id] ?? 0
            const views = postFakeViews(p.id, comments, reactions)
            return (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="block px-4 py-3 hover:bg-muted/30">
                  <p className="font-medium text-sm line-clamp-1">{p.title || '(제목 없음)'}</p>
                  <p className="text-muted-foreground text-xs mt-0.5"><RelativeTime date={p.created_at} /></p>
                  <div className="flex items-center gap-4 mt-2 text-muted-foreground text-xs font-medium tabular-nums">
                    <span className="flex items-center gap-1"><MessageCircle className="size-3.5" />{comments}</span>
                    <span className="flex items-center gap-1 font-bold text-red-500 dark:text-red-400"><span>🌶️</span>{reactions}</span>
                    <span className="flex items-center gap-1"><Eye className="size-3.5" />{views}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
