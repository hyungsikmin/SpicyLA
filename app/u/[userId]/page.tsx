'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getAvatarUrl } from '@/lib/storage'
import { getAvatarColorClass } from '@/lib/avatarColors'
import { userAvatarEmoji } from '@/lib/postAvatar'
import RelativeTime from '@/components/RelativeTime'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { MessageCircle, Eye } from 'lucide-react'

type Post = { id: string; title: string | null; body: string; is_spicy: boolean; created_at: string }
type Profile = { anon_name: string | null; avatar_path: string | null; profile_color_index: number | null }

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return Math.abs(h)
}
function postFakeViews(postId: string, comments: number, reactions: number) {
  return (hashStr(postId) % 400) + 50 + comments * 3 + reactions * 2
}

export default function UserPostsPage() {
  const params = useParams()
  const userId = params.userId as string
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      const [profileRes, postsRes] = await Promise.all([
        supabase.from('profiles').select('anon_name, avatar_path, profile_color_index').eq('user_id', userId).single(),
        supabase.from('posts').select('id, title, body, is_spicy, created_at').eq('user_id', userId).eq('status', 'visible').order('created_at', { ascending: false }),
      ])
      const postList = (postsRes.data ?? []) as Post[]
      setProfile(profileRes.data as Profile | null)
      setPosts(postList)
      if (postList.length > 0) {
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
      }
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) {
    return (
      <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background flex items-center justify-center p-8">
        <p className="text-muted-foreground">로딩 중…</p>
      </main>
    )
  }

  const anonName = profile?.anon_name?.trim() || '익명'
  const avatarUrl = getAvatarUrl(profile?.avatar_path ?? null)
  const colorClass = getAvatarColorClass(profile?.profile_color_index ?? null, userId)

  return (
    <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">←</Link>
        </Button>
        <h1 className="text-lg font-semibold truncate flex-1 min-w-0">글 목록</h1>
      </header>
      <section className="px-4 py-6 flex flex-col items-center gap-3 border-b border-border">
        <div className={`size-16 rounded-full flex items-center justify-center text-2xl overflow-visible ${!avatarUrl ? colorClass : 'relative'}`}>
          {avatarUrl ? (
            <>
              <div className={`absolute inset-0 rounded-full ${colorClass}`} aria-hidden />
              <div className="relative size-12 rounded-full overflow-hidden bg-background ring-2 ring-background">
                <Image src={avatarUrl} alt="" width={48} height={48} className="w-full h-full object-cover" />
              </div>
            </>
          ) : (
            userAvatarEmoji(userId)
          )}
        </div>
        <p className="font-semibold text-foreground">{anonName}</p>
      </section>
      <ul className="divide-y divide-border">
        {posts.length === 0 && (
          <li className="py-12 text-center text-muted-foreground text-sm">아직 글이 없어요.</li>
        )}
        {posts.map((post) => {
          const comments = commentCounts[post.id] ?? 0
          const reactions = reactionCounts[post.id] ?? 0
          const views = postFakeViews(post.id, comments, reactions)
          return (
            <li key={post.id}>
              <Link href={`/p/${post.id}`} className="flex gap-3 px-4 py-4 hover:bg-muted/30 transition-colors block">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.title && <span className="font-semibold text-[15px]">{post.title}</span>}
                    {post.is_spicy && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40">
                        멤버만 공개🥵
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] text-foreground/90 mt-0.5 line-clamp-2 whitespace-pre-line">{post.body}</p>
                  <span className="mt-1 block"><RelativeTime date={post.created_at} /></span>
                  <div className="flex items-center gap-4 mt-2 text-muted-foreground text-xs font-medium tabular-nums">
                    <span className="flex items-center gap-1"><MessageCircle className="size-3.5" />{comments}</span>
                    <span className="flex items-center gap-1 font-bold text-red-500 dark:text-red-400"><span>🌶️</span>{reactions}</span>
                    <span className="flex items-center gap-1"><Eye className="size-3.5" />{views}</span>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
