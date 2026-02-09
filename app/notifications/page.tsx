'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getAvatarUrl } from '@/lib/storage'
import { getAvatarColorClass } from '@/lib/avatarColors'
import { userAvatarEmoji } from '@/lib/postAvatar'
import { Button } from '@/components/ui/button'
import { MessageCircle, Heart, Vote, ThumbsUp, ThumbsDown, AtSign } from 'lucide-react'
import Image from 'next/image'
import RelativeTime from '@/components/RelativeTime'

const REACTION_EMOJI: Record<string, string> = {
  laugh: '🤣', angry: '😡', mindblown: '🤯', eyes: '👀', chili: '🌶️',
}

type NotificationItem = {
  type: 'comment' | 'reaction' | 'poll_vote' | 'procon_vote' | 'mention'
  created_at: string
  post_id: string
  actor_anon_name: string
  actor_user_id: string
  actor_avatar_url?: string | null
  actor_color_class?: string
  snippet?: string
  reaction_type?: string
  procon_side?: 'pro' | 'con'
}

export default function NotificationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [myAnonName, setMyAnonName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login?from=/notifications')
        return
      }
      setUser(data.user)
    })
  }, [router])

  useEffect(() => {
    if (!user?.id) return
    const run = async () => {
      const me = user.id
      const { data: profile } = await supabase.from('profiles').select('anon_name').eq('user_id', me).maybeSingle()
      const anonName = (profile as { anon_name?: string | null } | null)?.anon_name?.trim() ?? null
      setMyAnonName(anonName)

      const { data: myPosts } = await supabase.from('posts').select('id').eq('user_id', me).eq('status', 'visible')
      const myPostIds = (myPosts ?? []).map((p: { id: string }) => p.id)

      const all: NotificationItem[] = []

      if (myPostIds.length > 0) {
        const { data: comments } = await supabase
          .from('comments')
          .select('id, post_id, body, user_id, created_at')
          .in('post_id', myPostIds)
          .neq('user_id', me)
          .order('created_at', { ascending: false })
          .limit(100)
        const commentUserIds = [...new Set((comments ?? []).map((c: { user_id: string }) => c.user_id))]
        const { data: commentProfiles } = commentUserIds.length > 0
          ? await supabase.from('profiles').select('user_id, anon_name, avatar_path, profile_color_index').in('user_id', commentUserIds)
          : { data: [] }
        const profileByUserId = new Map((commentProfiles ?? []).map((p: { user_id: string; anon_name: string | null; avatar_path?: string | null; profile_color_index?: number | null }) => [p.user_id, p]))
        for (const c of comments ?? []) {
          const r = c as { id: string; post_id: string; body: string; user_id: string; created_at: string }
          const p = profileByUserId.get(r.user_id) as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | undefined
          const snippet = r.body?.replace(/\s+/g, ' ').trim().slice(0, 40) + (r.body && r.body.length > 40 ? '…' : '')
          all.push({
            type: 'comment',
            created_at: r.created_at,
            post_id: r.post_id,
            actor_anon_name: p?.anon_name?.trim() || '익명',
            actor_user_id: r.user_id,
            actor_avatar_url: p?.avatar_path ? getAvatarUrl(p.avatar_path) : null,
            actor_color_class: getAvatarColorClass(p?.profile_color_index ?? null, r.user_id),
            snippet: snippet || undefined,
          })
        }

        const { data: reactions } = await supabase
          .from('post_reactions')
          .select('post_id, user_id, reaction_type, created_at')
          .in('post_id', myPostIds)
          .neq('user_id', me)
          .order('created_at', { ascending: false })
          .limit(100)
        const reactionUserIds = [...new Set((reactions ?? []).map((r: { user_id: string }) => r.user_id))]
        const { data: reactionProfiles } = reactionUserIds.length > 0
          ? await supabase.from('profiles').select('user_id, anon_name, avatar_path, profile_color_index').in('user_id', reactionUserIds)
          : { data: [] }
        const reactionProfileByUserId = new Map((reactionProfiles ?? []).map((p: { user_id: string; anon_name: string | null; avatar_path?: string | null; profile_color_index?: number | null }) => [p.user_id, p]))
        for (const r of reactions ?? []) {
          const x = r as { post_id: string; user_id: string; reaction_type: string; created_at: string }
          const p = reactionProfileByUserId.get(x.user_id) as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | undefined
          all.push({
            type: 'reaction',
            created_at: x.created_at,
            post_id: x.post_id,
            actor_anon_name: p?.anon_name?.trim() || '익명',
            actor_user_id: x.user_id,
            actor_avatar_url: p?.avatar_path ? getAvatarUrl(p.avatar_path) : null,
            actor_color_class: getAvatarColorClass(p?.profile_color_index ?? null, x.user_id),
            reaction_type: x.reaction_type,
          })
        }

        const { data: pollRows } = await supabase.from('post_polls').select('post_id').in('post_id', myPostIds)
        const pollPostIds = (pollRows ?? []).map((p: { post_id: string }) => p.post_id)
        if (pollPostIds.length > 0) {
          const { data: pollVotes } = await supabase
            .from('post_poll_votes')
            .select('post_id, user_id, created_at')
            .in('post_id', pollPostIds)
            .neq('user_id', me)
            .order('created_at', { ascending: false })
            .limit(100)
          const pvUserIds = [...new Set((pollVotes ?? []).map((v: { user_id: string }) => v.user_id))]
          const { data: pvProfiles } = pvUserIds.length > 0
            ? await supabase.from('profiles').select('user_id, anon_name, avatar_path, profile_color_index').in('user_id', pvUserIds)
            : { data: [] }
          const pvProfileByUserId = new Map((pvProfiles ?? []).map((p: { user_id: string; anon_name: string | null; avatar_path?: string | null; profile_color_index?: number | null }) => [p.user_id, p]))
          for (const v of pollVotes ?? []) {
            const x = v as { post_id: string; user_id: string; created_at: string }
            const p = pvProfileByUserId.get(x.user_id) as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | undefined
            all.push({
              type: 'poll_vote',
              created_at: x.created_at,
              post_id: x.post_id,
              actor_anon_name: p?.anon_name?.trim() || '익명',
              actor_user_id: x.user_id,
              actor_avatar_url: p?.avatar_path ? getAvatarUrl(p.avatar_path) : null,
              actor_color_class: getAvatarColorClass(p?.profile_color_index ?? null, x.user_id),
            })
          }
        }

        const { data: proconRows } = await supabase.from('post_procon').select('post_id').in('post_id', myPostIds)
        const proconPostIds = (proconRows ?? []).map((p: { post_id: string }) => p.post_id)
        if (proconPostIds.length > 0) {
          const { data: proconVotes } = await supabase
            .from('post_procon_votes')
            .select('post_id, user_id, side, created_at')
            .in('post_id', proconPostIds)
            .neq('user_id', me)
            .order('created_at', { ascending: false })
            .limit(100)
          const pcvUserIds = [...new Set((proconVotes ?? []).map((v: { user_id: string }) => v.user_id))]
          const { data: pcvProfiles } = pcvUserIds.length > 0
            ? await supabase.from('profiles').select('user_id, anon_name, avatar_path, profile_color_index').in('user_id', pcvUserIds)
            : { data: [] }
          const pcvProfileByUserId = new Map((pcvProfiles ?? []).map((p: { user_id: string; anon_name: string | null; avatar_path?: string | null; profile_color_index?: number | null }) => [p.user_id, p]))
          for (const v of proconVotes ?? []) {
            const x = v as { post_id: string; user_id: string; side: string; created_at: string }
            const p = pcvProfileByUserId.get(x.user_id) as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | undefined
            all.push({
              type: 'procon_vote',
              created_at: x.created_at,
              post_id: x.post_id,
              actor_anon_name: p?.anon_name?.trim() || '익명',
              actor_user_id: x.user_id,
              actor_avatar_url: p?.avatar_path ? getAvatarUrl(p.avatar_path) : null,
              actor_color_class: getAvatarColorClass(p?.profile_color_index ?? null, x.user_id),
              procon_side: x.side as 'pro' | 'con',
            })
          }
        }
      }

      if (anonName) {
        const mentionPattern = '%@' + anonName.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%'
        const { data: mentionComments } = await supabase
          .from('comments')
          .select('id, post_id, body, user_id, created_at')
          .ilike('body', mentionPattern)
          .neq('user_id', me)
          .order('created_at', { ascending: false })
          .limit(100)
        const mentionPostIds = [...new Set((mentionComments ?? []).map((c: { post_id: string }) => c.post_id))]
        const { data: mentionPosts } = mentionPostIds.length > 0
          ? await supabase.from('posts').select('id, user_id').in('id', mentionPostIds)
          : { data: [] }
        const postOwnerByPostId = new Map((mentionPosts ?? []).map((p: { id: string; user_id: string }) => [p.id, p.user_id]))
        const mentionUserIds = [...new Set((mentionComments ?? []).map((c: { user_id: string }) => c.user_id))]
        const { data: mentionProfiles } = mentionUserIds.length > 0
          ? await supabase.from('profiles').select('user_id, anon_name, avatar_path, profile_color_index').in('user_id', mentionUserIds)
          : { data: [] }
        const mentionProfileByUserId = new Map((mentionProfiles ?? []).map((p: { user_id: string; anon_name: string | null; avatar_path?: string | null; profile_color_index?: number | null }) => [p.user_id, p]))
        for (const c of mentionComments ?? []) {
          const r = c as { id: string; post_id: string; body: string; user_id: string; created_at: string }
          if (postOwnerByPostId.get(r.post_id) === me) continue
          const p = mentionProfileByUserId.get(r.user_id) as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | undefined
          const snippet = r.body?.replace(/\s+/g, ' ').trim().slice(0, 40) + (r.body && r.body.length > 40 ? '…' : '')
          all.push({
            type: 'mention',
            created_at: r.created_at,
            post_id: r.post_id,
            actor_anon_name: p?.anon_name?.trim() || '익명',
            actor_user_id: r.user_id,
            actor_avatar_url: p?.avatar_path ? getAvatarUrl(p.avatar_path) : null,
            actor_color_class: getAvatarColorClass(p?.profile_color_index ?? null, r.user_id),
            snippet: snippet || undefined,
          })
        }
      }

      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setItems(all.slice(0, 50))
      setLoading(false)
    }
    run()
  }, [user?.id])

  if (!user) {
    return (
      <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background flex items-center justify-center p-8">
        <p className="text-muted-foreground">로딩 중…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" className="shrink-0 -ml-2" asChild>
          <Link href="/">←</Link>
        </Button>
        <h1 className="text-lg font-semibold flex-1 min-w-0">내 알림</h1>
      </header>

      <section className="px-4 py-4">
        {loading ? (
          <p className="text-muted-foreground text-sm">로딩 중…</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">아직 알림이 없어요.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item, i) => (
              <li key={`${item.type}-${item.post_id}-${item.actor_user_id}-${item.created_at}-${i}`}>
                <Link
                  href={`/p/${item.post_id}`}
                  className="flex gap-3 py-3 hover:bg-muted/30 transition-colors -mx-2 px-2 rounded-lg"
                >
                  <div className={`shrink-0 size-10 rounded-full flex items-center justify-center text-lg overflow-visible ${!item.actor_avatar_url ? item.actor_color_class ?? getAvatarColorClass(null, item.actor_user_id) : 'relative'}`}>
                    {item.actor_avatar_url ? (
                      <>
                        <div className={`absolute inset-0 rounded-full ${item.actor_color_class ?? getAvatarColorClass(null, item.actor_user_id)}`} aria-hidden />
                        <div className="relative size-8 rounded-full overflow-hidden bg-background ring-2 ring-background">
                          <Image src={item.actor_avatar_url} alt="" width={32} height={32} className="w-full h-full object-cover" />
                        </div>
                      </>
                    ) : (
                      userAvatarEmoji(item.actor_user_id)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{item.actor_anon_name}</span>
                      {item.type === 'comment' && '님이 댓글을 남겼어요'}
                      {item.type === 'reaction' && `님이 ${REACTION_EMOJI[item.reaction_type ?? 'chili'] ?? '🌶️'} 표시를 했어요`}
                      {item.type === 'poll_vote' && '님이 투표에 참여했어요'}
                      {item.type === 'procon_vote' && `님이 ${item.procon_side === 'pro' ? '찬성' : '반대'}를 선택했어요`}
                      {item.type === 'mention' && '님이 댓글에서 멘션했어요'}
                    </p>
                    {item.snippet && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.snippet}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      <RelativeTime date={item.created_at} />
                    </p>
                  </div>
                  <span className="shrink-0 text-muted-foreground self-center" aria-hidden>
                    {item.type === 'comment' && <MessageCircle className="size-4" />}
                    {item.type === 'reaction' && <Heart className="size-4" />}
                    {item.type === 'poll_vote' && <Vote className="size-4" />}
                    {item.type === 'procon_vote' && (item.procon_side === 'pro' ? <ThumbsUp className="size-4" /> : <ThumbsDown className="size-4" />)}
                    {item.type === 'mention' && <AtSign className="size-4" />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
