'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { MessageCircle, Eye, Sun, Moon, Plus, Flame, Bell, User as UserIcon, Home, Sparkles, ExternalLink } from 'lucide-react'
import { getPostImageUrl, getAvatarUrl, getBusinessSpotlightMediaUrl } from '@/lib/storage'
import { getAvatarColorClass } from '@/lib/avatarColors'
import { userAvatarEmoji, userAvatarColor } from '@/lib/postAvatar'
import { fetchSiteSettings, fetchTiers, resolveTier, type SiteSettings, type Tier } from '@/lib/siteSettings'
import RelativeTime from '@/components/RelativeTime'
import WriteForm from '@/components/WriteForm'

type Post = {
  id: string
  user_id: string
  title: string | null
  body: string
  is_spicy: boolean
  created_at: string
  category?: string | null
}

const PAGE_SIZE = 10
const DEFAULT_TRENDING_MIN = 10
const DEFAULT_TRENDING_MAX = 3
const DEFAULT_BEST_COMMENT_MIN_LIKES = 1
const DEFAULT_SEOLJJANGI_MIN_POSTS = 2

const FILTERS = [
  { id: 'work', label: '일', icon: '💻' },
  { id: 'eat', label: '먹', icon: '🍴' },
  { id: 'home', label: '집', icon: '🏠' },
  { id: 'story', label: '썰', icon: '🔥' },
  { id: 'all', label: '전체보기', icon: '📋' },
] as const
const REACTION_EMOJI: Record<string, string> = {
  laugh: '🤣', angry: '😡', mindblown: '🤯', eyes: '👀', chili: '🌶️',
}
// 자영업 섹션과 비슷한 채도 (from-red-500/8 수준)
const TRENDING_GRADIENT = 'bg-gradient-to-b from-pink-400/8 via-purple-400/6 to-transparent dark:from-pink-500/6 dark:to-transparent'

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return Math.abs(h)
}
function postFakeViews(postId: string, comments: number, reactions: number) {
  return (hashStr(postId) % 400) + 50 + comments * 3 + reactions * 2
}

function PostCardSkeleton() {
  return (
    <li className="border-b border-border animate-pulse">
      <div className="flex gap-3 px-4 py-4">
        <div className="shrink-0 size-14 rounded-full bg-muted" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-full max-w-[70%]" />
          <div className="h-3 bg-muted rounded w-full max-w-[90%]" />
          <div className="h-3 bg-muted rounded w-16" />
        </div>
      </div>
    </li>
  )
}

function NotificationBubble({
  type, postId, anonName, commentSnippet, reactionEmoji, onDismiss,
}: {
  type: 'comment' | 'reaction'
  postId: string
  anonName: string
  commentSnippet?: string
  reactionEmoji?: string
  onDismiss: () => void
}) {
  const [opaque, setOpaque] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setOpaque(true))
    return () => cancelAnimationFrame(t)
  }, [])
  const displayName = anonName?.trim() || '익명'
  const text = type === 'comment'
    ? `${displayName}가 댓글 남김${commentSnippet ? `: ${commentSnippet}` : ''}`
    : `${displayName}님이 ${reactionEmoji ?? '🌶️'} 표시했습니다`
  return (
    <div className={`fixed bottom-20 left-4 right-4 z-30 mx-auto max-w-[600px] transition-opacity duration-300 ${opaque ? 'opacity-100' : 'opacity-0'}`} role="status">
      <div className="flex items-center gap-2 rounded-full bg-muted/95 backdrop-blur border border-border shadow-lg px-4 py-3">
        <Link href={`/p/${postId}`} onClick={() => onDismiss()} className="flex-1 min-w-0 text-left text-sm text-foreground truncate">{text}</Link>
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss() }} className="shrink-0 size-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="닫기">×</button>
      </div>
    </div>
  )
}

function SectionDivider() {
  return <div className="h-2 w-full bg-muted border-0 shrink-0" role="presentation" aria-hidden />
}

function AnimateInView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: '40px', threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'} ${className ?? ''}`}>
      {children}
    </div>
  )
}

function PostCard({
  post, user, commentCount, reactionCount, postMedia, postFakeViews, anonName, avatarUrl, avatarColorClass, tierLabel, tierBadgeColor, bestCommentPreview,
}: {
  post: Post
  user: User | null
  commentCount: number
  reactionCount: number
  postMedia: string[] | undefined
  postFakeViews: (id: string, c: number, r: number) => number
  anonName: string
  avatarUrl?: string | null
  avatarColorClass?: string
  tierLabel?: string | null
  tierBadgeColor?: string | null
  bestCommentPreview?: string | null
}) {
  const fakeViews = postFakeViews(post.id, commentCount, reactionCount)
  const colorClass = avatarColorClass ?? userAvatarColor(post.user_id)
  return (
    <AnimateInView>
      <li className="border-b border-border">
        <Link href={`/p/${post.id}`} className="flex gap-3 px-4 py-4 hover:bg-muted/30 transition-colors block">
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div className={`size-14 rounded-full flex items-center justify-center text-2xl overflow-visible ${!avatarUrl ? colorClass : 'relative'}`}>
              {avatarUrl ? (
                <>
                  <div className={`absolute inset-0 rounded-full ${colorClass}`} aria-hidden />
                  <div className="relative size-11 rounded-full overflow-hidden bg-background ring-2 ring-background">
                    <Image src={avatarUrl} alt="" width={44} height={44} className="w-full h-full object-cover" />
                  </div>
                </>
              ) : (
                userAvatarEmoji(post.user_id)
              )}
            </div>
            {tierLabel && (
              <span
                className={!tierBadgeColor ? 'rounded-full bg-[var(--spicy)]/20 text-[var(--spicy)] text-[10px] font-semibold px-1.5 py-0.5 border border-[var(--spicy)]/40 whitespace-nowrap' : 'rounded-full text-[10px] font-semibold px-1.5 py-0.5 border whitespace-nowrap'}
                style={tierBadgeColor ? { color: tierBadgeColor, backgroundColor: tierBadgeColor + '20', borderColor: tierBadgeColor + '40' } : undefined}
              >
                {tierLabel}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-sm">{anonName}</span>
              <span className="text-muted-foreground text-sm">·</span>
              <RelativeTime date={post.created_at} />
              {post.category && (() => {
                const f = FILTERS.find((x) => x.id === post.category)
                if (!f || f.id === 'all') return null
                return (
                  <span className="text-muted-foreground text-xs font-medium ml-1" aria-label={`카테고리: ${f.label}`}>
                    {f.icon} {f.label}
                  </span>
                )
              })()}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {post.title && <p className="font-semibold text-[15px] leading-snug">{post.title}</p>}
              {post.is_spicy && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40">
                  멤버만 공개🥵
                </span>
              )}
            </div>
            {post.is_spicy && !user ? (
              <div className="relative min-h-[3rem] mt-1 flex items-start gap-2">
                <div className="relative flex-1 min-w-0">
                  <p className="blur-[2px] select-none text-[15px] leading-snug text-muted-foreground line-clamp-2 pointer-events-none">{post.body}</p>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/90 border border-border px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm">🔒 로그인하면 전체 공개</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40">🌶️ SPICY</span>
              </div>
            ) : (
              <p className="text-[15px] leading-snug text-foreground/95 mt-1 whitespace-pre-line line-clamp-2">{post.body}</p>
            )}
            {bestCommentPreview && (
              <p className="text-[13px] text-muted-foreground mt-2 pl-3 border-l-2 border-red-500/40 line-clamp-1">
                <span className="font-medium text-foreground/90">배댓</span> {bestCommentPreview}
              </p>
            )}
            {postMedia && postMedia.length > 0 && (
              post.is_spicy && !user ? (
                <div className="mt-3 rounded-2xl overflow-hidden bg-muted border border-border/50 w-full aspect-[4/3] max-h-80 relative">
                  <div className="absolute inset-0 blur-md bg-muted" />
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">🔒 로그인하면 볼 수 있어요</div>
                </div>
              ) : postMedia.length === 1 ? (
                <div className="mt-3 rounded-2xl overflow-hidden bg-muted border border-border/50 w-full aspect-[4/3] max-h-80 relative">
                  <Image src={postMedia[0]} alt="" fill className="object-cover" sizes="(max-width: 600px) 100vw, 568px" />
                </div>
              ) : (
                <div className="mt-3 w-full relative -mx-4 px-4">
                  <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 scroll-smooth pb-1 items-end">
                    {postMedia.map((url, i) => (
                      <div key={i} className="shrink-0 w-fit max-w-[40%] snap-start snap-always rounded-2xl overflow-hidden bg-muted border border-border/50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="max-h-52 sm:max-h-56 w-auto max-w-full block rounded-2xl" />
                      </div>
                    ))}
                  </div>
                  <span className="absolute bottom-3 right-6 rounded-full bg-black/70 text-white text-xs px-2.5 py-1 font-medium tabular-nums pointer-events-none">{postMedia.length}</span>
                </div>
              )
            )}
            <div className="flex items-center gap-4 mt-3 text-muted-foreground text-sm font-medium tabular-nums">
              <span className="flex items-center gap-1.5"><MessageCircle className="size-4 shrink-0" aria-hidden />{commentCount}</span>
              <span className="flex items-center gap-1.5 font-bold text-red-500 dark:text-red-400"><span aria-hidden>🌶️</span>{reactionCount}</span>
              <span className="flex items-center gap-1.5"><Eye className="size-4 shrink-0" aria-hidden />{fakeViews}</span>
            </div>
          </div>
        </Link>
      </li>
    </AnimateInView>
  )
}

function PostGridCard({
  post, user, commentCount, reactionCount, postMedia, anonName, avatarUrl, avatarColorClass,
}: {
  post: Post
  user: User | null
  commentCount: number
  reactionCount: number
  postMedia: string[] | undefined
  anonName: string
  avatarUrl?: string | null
  avatarColorClass?: string
}) {
  const firstMedia = postMedia?.[0]
  const colorClass = avatarColorClass ?? userAvatarColor(post.user_id)
  const titleOrBody = (post.title || post.body).replace(/\s+/g, ' ').trim().slice(0, 60)
  const isSpicyBlur = post.is_spicy && !user
  return (
    <li>
      <Link
        href={`/p/${post.id}`}
        className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow block"
        aria-label={post.title || '글 보기'}
      >
        <div className="relative w-full aspect-[4/3] bg-muted shrink-0">
          {firstMedia && !isSpicyBlur ? (
            <Image src={firstMedia} alt="" fill className="object-cover" sizes="(max-width: 600px) 50vw, 284px" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-muted-foreground/10 via-muted to-muted-foreground/5" aria-hidden />
          )}
          {isSpicyBlur && firstMedia && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">🔒</div>
          )}
        </div>
        <div className="p-3 flex flex-col gap-2 min-w-0">
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
            {isSpicyBlur ? '멤버만 공개' : titleOrBody}
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`size-6 rounded-full flex items-center justify-center text-xs shrink-0 overflow-hidden ${!avatarUrl ? colorClass : ''}`}>
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" width={24} height={24} className="w-full h-full object-cover" />
                ) : (
                  userAvatarEmoji(post.user_id)
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate">{anonName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs tabular-nums shrink-0">
              <span className="flex items-center gap-0.5"><MessageCircle className="size-3.5" aria-hidden />{commentCount}</span>
              <span className="flex items-center gap-0.5 text-red-500 dark:text-red-400 font-medium">🌶️ {reactionCount}</span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  )
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [postMedia, setPostMedia] = useState<Record<string, string[]>>({})
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [fakeLiveCount, setFakeLiveCount] = useState(23)
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [notification, setNotification] = useState<{ type: 'comment' | 'reaction' | 'post'; postId: string; anonName: string; actorUserId?: string; commentSnippet?: string; reactionEmoji?: string; titleSnippet?: string; actorAvatarUrl?: string; actorAvatarColorClass?: string } | null>(null)
  const [notificationKey, setNotificationKey] = useState(0)
  const [dark, setDark] = useState(false)
  const [writeOpen, setWriteOpen] = useState(false)
  const [region, setRegion] = useState<string>('LA')
  const [anonMap, setAnonMap] = useState<Record<string, string>>({})
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({})
  const [avatarColorMap, setAvatarColorMap] = useState<Record<string, string>>({})
  const [tierByUser, setTierByUser] = useState<Record<string, { name: string; badge_color: string | null } | null>>({})
  const [bestCommentByPost, setBestCommentByPost] = useState<Record<string, string>>({})
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [headerAnonName, setHeaderAnonName] = useState<string | null>(null)
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(null)
  const [headerAvatarColorClass, setHeaderAvatarColorClass] = useState<string>('')
  const [spicyOnly, setSpicyOnly] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('spicyOnly') === 'true' } catch { return false }
  })
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [popularMembers, setPopularMembers] = useState<Array<{ user_id: string; anon_name: string; avatar_url: string | null; colorClass: string }>>([])
  const [businessSpotlight, setBusinessSpotlight] = useState<Array<{ id: string; business_name: string; one_liner: string | null; link_url: string | null; instagram_url: string | null; media_path: string | null; media_type: string | null }>>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [trendingPostsData, setTrendingPostsData] = useState<Post[]>([])
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([fetchSiteSettings(), fetchTiers()]).then(([s, t]) => {
      setSiteSettings(s)
      setTiers(t)
    })
  }, [])

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])
  useEffect(() => {
    const sync = () => {
      try {
        setSpicyOnly(localStorage.getItem('spicyOnly') === 'true')
        setNotificationsEnabled(localStorage.getItem('notifications') !== 'false')
      } catch {}
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setDark(next)
  }
  useEffect(() => {
    setFakeLiveCount((Date.now() % 19) + 12)
  }, [])

  useEffect(() => {
    const count = siteSettings?.popular_members_count ?? 10
    const minScore = siteSettings?.popular_members_min_score ?? 0
    const load = async () => {
      const { data: postsData } = await supabase.from('posts').select('id, user_id').eq('status', 'visible').order('created_at', { ascending: false }).limit(300)
      if (!postsData?.length) return
      const postIds = postsData.map((p) => p.id)
      const postIdToUserId = new Map(postsData.map((p) => [p.id, p.user_id]))
      const [reactionsRes, commentsRes] = await Promise.all([
        supabase.from('post_reactions').select('post_id').in('post_id', postIds),
        supabase.from('comments').select('post_id').in('post_id', postIds),
      ])
      const scoreByUser: Record<string, number> = {}
      postsData.forEach((p) => { scoreByUser[p.user_id] = (scoreByUser[p.user_id] ?? 0) + 1 })
      ;(reactionsRes.data ?? []).forEach((r: { post_id: string }) => {
        const uid = postIdToUserId.get(r.post_id)
        if (uid) scoreByUser[uid] = (scoreByUser[uid] ?? 0) + 1
      })
      ;(commentsRes.data ?? []).forEach((c: { post_id: string }) => {
        const uid = postIdToUserId.get(c.post_id)
        if (uid) scoreByUser[uid] = (scoreByUser[uid] ?? 0) + 1
      })
      const topIds = Object.entries(scoreByUser)
        .filter(([, s]) => s >= minScore)
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([uid]) => uid)
      if (topIds.length === 0) return
      const { data: profiles } = await supabase.from('profiles').select('user_id, anon_name, avatar_path, profile_color_index').in('user_id', topIds)
      const order = new Map(topIds.map((id, i) => [id, i]))
      const list = (profiles ?? [])
        .sort((a, b) => (order.get(a.user_id) ?? 99) - (order.get(b.user_id) ?? 99))
        .map((p: { user_id: string; anon_name: string | null; avatar_path: string | null; profile_color_index: number | null }) => ({
          user_id: p.user_id,
          anon_name: p.anon_name?.trim() || '익명',
          avatar_url: getAvatarUrl(p.avatar_path),
          colorClass: getAvatarColorClass(p.profile_color_index ?? null, p.user_id),
        }))
      setPopularMembers(list)
    }
    load()
  }, [siteSettings?.popular_members_count, siteSettings?.popular_members_min_score])

  const [hasRegisteredBusiness, setHasRegisteredBusiness] = useState(false)
  useEffect(() => {
    supabase
      .from('business_spotlight')
      .select('id, business_name, one_liner, link_url, instagram_url, media_path, media_type')
      .eq('approved', true)
      .eq('is_hidden', false)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setBusinessSpotlight((data ?? []) as Array<{ id: string; business_name: string; one_liner: string | null; link_url: string | null; instagram_url: string | null; media_path: string | null; media_type: string | null }>))
  }, [])
  useEffect(() => {
    if (!user?.id) {
      setHasRegisteredBusiness(false)
      return
    }
    supabase.from('business_spotlight').select('id').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      setHasRegisteredBusiness(!!data)
    })
  }, [user?.id])

  const userIdRef = useRef<string | null>(null)
  userIdRef.current = user?.id ?? null
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null

    const subscribe = () => {
      channel = supabase
        .channel('activity-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
          const postId = (payload.new as { id: string }).id
          const uid = (payload.new as { user_id?: string })?.user_id
          const me = userIdRef.current
          if (uid === me) return
          const title = (payload.new as { title?: string | null })?.title ?? ''
          const titleSnippet = title.trim().length > 0 ? title.trim().slice(0, 20) + (title.trim().length > 20 ? '…' : '') : undefined
          const { data: profile } = uid ? await supabase.from('profiles').select('anon_name, avatar_path, profile_color_index').eq('user_id', uid).single() : { data: null }
        try { if (localStorage.getItem('notifications') === 'false') return } catch {}
        const p = profile as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | null
        const actorUrl = uid && p ? getAvatarUrl(p.avatar_path ?? null) : null
        const actorColor = uid && p ? getAvatarColorClass(p.profile_color_index ?? null, uid) : undefined
        setNotification({ type: 'post', postId, anonName: p?.anon_name?.trim() || '익명', actorUserId: uid ?? undefined, titleSnippet, actorAvatarUrl: actorUrl ?? undefined, actorAvatarColorClass: actorColor })
        setNotificationKey((k) => k + 1)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async (payload) => {
        const uid = (payload.new as { user_id?: string })?.user_id
        const me = userIdRef.current
        if (!uid || uid === me) return
        try { if (localStorage.getItem('notifications') === 'false') return } catch {}
        const postId = (payload.new as { post_id: string }).post_id
        const body = (payload.new as { body?: string })?.body ?? ''
        const trimmed = body.replace(/\s+/g, ' ').trim()
        const commentSnippet = trimmed.length > 0 ? trimmed.slice(0, 20) + (trimmed.length > 20 ? '…' : '') : undefined
        const { data: profile } = await supabase.from('profiles').select('anon_name, avatar_path, profile_color_index').eq('user_id', uid).single()
        const p = profile as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | null
        const actorUrl = p ? getAvatarUrl(p.avatar_path ?? null) : null
        const actorColor = p ? getAvatarColorClass(p.profile_color_index ?? null, uid) : undefined
        setNotification({ type: 'comment', postId, anonName: p?.anon_name?.trim() || '익명', actorUserId: uid, commentSnippet, actorAvatarUrl: actorUrl ?? undefined, actorAvatarColorClass: actorColor })
        setNotificationKey((k) => k + 1)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_reactions' }, async (payload) => {
        const uid = (payload.new as { user_id?: string })?.user_id
        const me = userIdRef.current
        if (!uid || uid === me) return
        try { if (localStorage.getItem('notifications') === 'false') return } catch {}
        const postId = (payload.new as { post_id: string }).post_id
        const reactionType = (payload.new as { reaction_type?: string })?.reaction_type ?? 'chili'
        const { data: profile } = await supabase.from('profiles').select('anon_name, avatar_path, profile_color_index').eq('user_id', uid).single()
        const p = profile as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | null
        const actorUrl = p ? getAvatarUrl(p.avatar_path ?? null) : null
        const actorColor = p ? getAvatarColorClass(p.profile_color_index ?? null, uid) : undefined
        setNotification({ type: 'reaction', postId, anonName: p?.anon_name?.trim() || '익명', actorUserId: uid, reactionEmoji: REACTION_EMOJI[reactionType] ?? '🌶️', actorAvatarUrl: actorUrl ?? undefined, actorAvatarColorClass: actorColor })
        setNotificationKey((k) => k + 1)
      })
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR' && err) {
            console.warn('[Realtime] subscription error:', err)
            retryTimeout = setTimeout(subscribe, 3000)
          }
        })
    }

    subscribe()
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout)
      channel?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])
  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false)
      return
    }
    supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      setIsAdmin(!!data)
    })
  }, [user?.id])
  useEffect(() => {
    if (!user?.id) {
      setHeaderAnonName(null)
      setHeaderAvatarUrl(null)
      setHeaderAvatarColorClass('')
      setBlockedIds(new Set())
      return
    }
    supabase.from('profiles').select('anon_name, avatar_path, profile_color_index').eq('user_id', user.id).single().then(({ data }) => {
      const d = data as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | null
      setHeaderAnonName(d?.anon_name?.trim() ?? null)
      const url = getAvatarUrl(d?.avatar_path ?? null)
      setHeaderAvatarUrl(url ?? null)
      setHeaderAvatarColorClass(getAvatarColorClass(d?.profile_color_index ?? null, user.id))
    })
    supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id).then(({ data }) => {
      setBlockedIds(new Set((data ?? []).map((r: { blocked_id: string }) => r.blocked_id)))
    })
  }, [user?.id])

  const fetchBatch = useCallback(async (offset: number, category: string, onlySpicy: boolean) => {
    let q = supabase.from('posts').select('id, user_id, title, body, is_spicy, created_at, category').order('pinned_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
    if (category !== 'all') q = q.eq('category', category)
    if (onlySpicy) q = q.eq('is_spicy', true)
    const { data } = await q
    return (data || []) as Post[]
  }, [])

  const fetchCountsAndThumbnails = useCallback(
    async (posts: { id: string; user_id: string }[]) => {
      if (posts.length === 0) return
      const postIds = posts.map((p) => p.id)
      const userIds = posts.map((p) => p.user_id)
      const uniqUserIds = [...new Set(userIds)]
      const postIdToUserId = new Map(posts.map((p) => [p.id, p.user_id]))
      const [reactions, comments, media, profilesRes, postsByUserRes, commentsWithBody, commentsByUserRes, allPostsByUsersRes] = await Promise.all([
        supabase.from('post_reactions').select('post_id').in('post_id', postIds),
        supabase.from('comments').select('post_id').in('post_id', postIds),
        supabase.from('post_media').select('post_id, file_path, position').in('post_id', postIds).order('position'),
        uniqUserIds.length > 0 ? supabase.from('profiles').select('user_id, anon_name, avatar_path, profile_color_index').in('user_id', uniqUserIds) : Promise.resolve({ data: [] }),
        uniqUserIds.length > 0 ? supabase.from('posts').select('user_id').in('user_id', uniqUserIds).eq('status', 'visible') : Promise.resolve({ data: [] }),
        supabase.from('comments').select('id, post_id, body').in('post_id', postIds),
        uniqUserIds.length > 0 ? supabase.from('comments').select('user_id').in('user_id', uniqUserIds) : Promise.resolve({ data: [] }),
        uniqUserIds.length > 0 ? supabase.from('posts').select('id, user_id').in('user_id', uniqUserIds).eq('status', 'visible') : Promise.resolve({ data: [] }),
      ])
      const commentIds = (commentsWithBody?.data ?? []).map((c: { id: string }) => c.id)
      const { data: commentLikesData } = commentIds.length > 0
        ? await supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds)
        : { data: [] as { comment_id: string }[] }
      const anonByUser: Record<string, string> = {}
      const avatarByUser: Record<string, string> = {}
      const colorByUser: Record<string, string> = {}
      profilesRes.data?.forEach((p: { user_id: string; anon_name: string | null; avatar_path?: string | null; profile_color_index?: number | null }) => {
        anonByUser[p.user_id] = p.anon_name?.trim() || '익명'
        const url = getAvatarUrl(p.avatar_path ?? null)
        if (url) avatarByUser[p.user_id] = url
        colorByUser[p.user_id] = getAvatarColorClass(p.profile_color_index ?? null, p.user_id)
      })
      const postCountByUser: Record<string, number> = {}
      uniqUserIds.forEach((id) => { postCountByUser[id] = 0 })
      ;(postsByUserRes.data ?? []).forEach((r: { user_id: string }) => {
        postCountByUser[r.user_id] = (postCountByUser[r.user_id] ?? 0) + 1
      })
      const commentCountByUser: Record<string, number> = {}
      uniqUserIds.forEach((id) => { commentCountByUser[id] = 0 })
      ;((commentsByUserRes as { data?: { user_id: string }[] }).data ?? []).forEach((r: { user_id: string }) => {
        commentCountByUser[r.user_id] = (commentCountByUser[r.user_id] ?? 0) + 1
      })
      const reactionCount: Record<string, number> = {}
      postIds.forEach((id) => { reactionCount[id] = 0 })
      reactions.data?.forEach((r) => (reactionCount[r.post_id] = (reactionCount[r.post_id] ?? 0) + 1))
      const reactionCountByUser: Record<string, number> = {}
      uniqUserIds.forEach((id) => { reactionCountByUser[id] = 0 })
      const allPostsByUsers = (allPostsByUsersRes.data ?? []) as { id: string; user_id: string }[]
      const allPostIdToUserId = new Map(allPostsByUsers.map((r) => [r.id, r.user_id]))
      if (allPostsByUsers.length > 0) {
        const allPostIds = allPostsByUsers.map((r) => r.id)
        const { data: allReactions } = await supabase.from('post_reactions').select('post_id').in('post_id', allPostIds)
        ;(allReactions ?? []).forEach((r: { post_id: string }) => {
          const uid = allPostIdToUserId.get(r.post_id)
          if (uid) reactionCountByUser[uid] = (reactionCountByUser[uid] ?? 0) + 1
        })
      }
      const newTierByUser: Record<string, { name: string; badge_color: string | null } | null> = {}
      uniqUserIds.forEach((uid) => {
        const tier = resolveTier(tiers, postCountByUser[uid] ?? 0, commentCountByUser[uid] ?? 0, reactionCountByUser[uid] ?? 0)
        newTierByUser[uid] = tier ? { name: tier.name, badge_color: tier.badge_color ?? null } : null
      })
      setTierByUser((prev) => ({ ...prev, ...newTierByUser }))
      setAnonMap((prev) => ({ ...prev, ...anonByUser }))
      setAvatarMap((prev) => ({ ...prev, ...avatarByUser }))
      setAvatarColorMap((prev) => ({ ...prev, ...colorByUser }))
      const commentCount: Record<string, number> = {}
      postIds.forEach((id) => { commentCount[id] = 0 })
      comments.data?.forEach((r) => (commentCount[r.post_id] = (commentCount[r.post_id] ?? 0) + 1))
      const mediaByPost: Record<string, string[]> = {}
      const grouped = new Map<string, { file_path: string; position: number }[]>()
      media.data?.forEach((r) => {
        if (!grouped.has(r.post_id)) grouped.set(r.post_id, [])
        grouped.get(r.post_id)!.push({ file_path: r.file_path, position: r.position })
      })
      grouped.forEach((rows, postId) => {
        const sorted = [...rows].sort((a, b) => a.position - b.position)
        mediaByPost[postId] = sorted.map((r) => getPostImageUrl(r.file_path))
      })
      const likeCountByComment: Record<string, number> = {}
      commentIds.forEach((cid) => { likeCountByComment[cid] = 0 })
      ;(commentLikesData ?? []).forEach((r: { comment_id: string }) => {
        likeCountByComment[r.comment_id] = (likeCountByComment[r.comment_id] ?? 0) + 1
      })
      const bestByPost: Record<string, string> = {}
      const commentsList = (commentsWithBody?.data ?? []) as { id: string; post_id: string; body: string }[]
      const bestCommentMinLikes = siteSettings?.best_comment_min_likes ?? DEFAULT_BEST_COMMENT_MIN_LIKES
      postIds.forEach((pid) => {
        const postComments = commentsList.filter((c) => c.post_id === pid)
        if (postComments.length === 0) return
        const best = postComments.reduce((a, b) =>
          (likeCountByComment[a.id] ?? 0) >= (likeCountByComment[b.id] ?? 0) ? a : b
        )
        if ((likeCountByComment[best.id] ?? 0) < bestCommentMinLikes) return
        const raw = (best.body || '').replace(/\s+/g, ' ').trim()
        const firstLine = raw.slice(0, 50) + (raw.length > 50 ? '…' : '')
        if (firstLine) bestByPost[pid] = firstLine
      })
      setBestCommentByPost((prev) => ({ ...prev, ...bestByPost }))
      setReactionCounts((prev) => ({ ...prev, ...reactionCount }))
      setCommentCounts((prev) => ({ ...prev, ...commentCount }))
      setPostMedia((prev) => ({ ...prev, ...mediaByPost }))
    },
    [siteSettings, tiers]
  )

  useEffect(() => {
    if (siteSettings == null || tiers.length === 0) return
    setPosts([])
    setHasMore(true)
    setInitialLoading(true)
    let cancelled = false
    const run = async () => {
      const blocked =
        user?.id != null
          ? await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id).then((r) => (r.data ?? []).map((x: { blocked_id: string }) => x.blocked_id))
          : []
      if (cancelled) return
      const data = await fetchBatch(0, selectedFilter, spicyOnly)
      if (cancelled) return
      const blockedSet = new Set(blocked)
      setBlockedIds(blockedSet)
      const filtered = blockedSet.size > 0 ? data.filter((p) => !blockedSet.has(p.user_id)) : data
      setPosts(filtered)
      setHasMore(filtered.length === PAGE_SIZE)
      await fetchCountsAndThumbnails(filtered)
      if (!cancelled) setInitialLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [selectedFilter, spicyOnly, fetchBatch, fetchCountsAndThumbnails, user?.id, siteSettings, tiers])

  useEffect(() => {
    if (siteSettings == null || tiers.length === 0) return
    const minC = siteSettings.trending_min_count ?? DEFAULT_TRENDING_MIN
    const maxC = siteSettings.trending_max ?? DEFAULT_TRENDING_MAX
    supabase.rpc('get_trending_post_ids', { p_min_count: minC, p_max_count: maxC }).then(({ data: ids, error }) => {
      if (error || !ids?.length) {
        setTrendingPostsData([])
        return
      }
      const idList = ids as { post_id: string }[]
      const orderIds = idList.map((r) => r.post_id)
      supabase
        .from('posts')
        .select('id, user_id, title, body, is_spicy, created_at, category')
        .in('id', orderIds)
        .then(({ data: rows }) => {
          const byId = new Map((rows ?? []).map((p) => [p.id, p]))
          const ordered = orderIds.map((id) => byId.get(id)).filter(Boolean) as Post[]
          setTrendingPostsData(ordered)
          if (ordered.length > 0) fetchCountsAndThumbnails(ordered)
        })
    })
  }, [siteSettings, tiers.length, fetchCountsAndThumbnails])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const next = await fetchBatch(posts.length, selectedFilter, spicyOnly)
    setLoadingMore(false)
    if (next.length === 0) { setHasMore(false); return }
    const filteredNext = blockedIds.size > 0 ? next.filter((p) => !blockedIds.has(p.user_id)) : next
    setPosts((prev) => [...prev, ...filteredNext])
    setHasMore(next.length === PAGE_SIZE)
    fetchCountsAndThumbnails(filteredNext)
  }, [loadingMore, hasMore, posts.length, selectedFilter, spicyOnly, fetchBatch, fetchCountsAndThumbnails, blockedIds])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loadingMore) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, loadMore])

  const handleWriteSuccess = useCallback(() => {
    setWriteOpen(false)
    fetchBatch(0, selectedFilter, spicyOnly).then((data) => {
      setPosts(data)
      setHasMore(data.length === PAGE_SIZE)
      fetchCountsAndThumbnails(data)
    })
  }, [selectedFilter, spicyOnly, fetchBatch, fetchCountsAndThumbnails])

  const uniquePosts = Array.from(new Map(posts.map((p) => [p.id, p])).values())
  const filteredBySpicy = spicyOnly ? uniquePosts.filter((p) => p.is_spicy) : uniquePosts
  const filteredPosts = blockedIds.size > 0 ? filteredBySpicy.filter((p) => !blockedIds.has(p.user_id)) : filteredBySpicy
  const trendingMin = siteSettings?.trending_min_count ?? DEFAULT_TRENDING_MIN
  const trendingMax = siteSettings?.trending_max ?? DEFAULT_TRENDING_MAX
  const trendingFromFeed =
    trendingPostsData.length === 0
      ? filteredPosts
          .filter((p) => (reactionCounts[p.id] ?? 0) >= trendingMin)
          .sort((a, b) => {
            const ca = reactionCounts[a.id] ?? 0
            const cb = reactionCounts[b.id] ?? 0
            if (cb !== ca) return cb - ca
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
          .slice(0, trendingMax)
      : []
  const trendingPostsDisplay =
    trendingPostsData.length > 0
      ? trendingPostsData.filter((p) => !blockedIds.has(p.user_id))
      : trendingFromFeed
  const trendingIds = new Set(trendingPostsDisplay.map((p) => p.id))
  const latestPosts = filteredPosts.filter((p) => !trendingIds.has(p.id))

  return (
    <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-foreground shrink-0">아니스비</h1>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="shrink-0 min-w-[4rem] w-20 rounded-full border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="지역 선택"
          >
            <option value="LA">📍 LA</option>
            <option value="SD" disabled>📍 SD (coming soon)</option>
            <option value="OC" disabled>📍 OC (coming soon)</option>
            <option value="SF" disabled>📍 SF (coming soon)</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          {isAdmin && (
            <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground shrink-0 text-xs" asChild>
              <Link href="/admin">관리자</Link>
            </Button>
          )}
          <button type="button" onClick={toggleTheme} className="shrink-0 size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          {user ? (
            <Button variant="outline" size="sm" className="rounded-full border-border text-foreground text-sm" onClick={() => supabase.auth.signOut()}>
              로그아웃
            </Button>
          ) : (
            <Link href="/login">
              <Button size="sm" className="rounded-full bg-[var(--cta)] text-[var(--cta-foreground)] hover:opacity-90 text-sm font-medium">
                로그인
              </Button>
            </Link>
          )}
        </div>
      </header>

      <section className="px-4 py-6 space-y-3">
        <p className="text-lg font-semibold text-foreground leading-snug">
          20·30의 노빠꾸 커뮤니티 🥵
        </p>
        <button
          type="button"
          onClick={() => document.getElementById('feed-filters')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          어떤 이야기가 궁금하세요?
        </button>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            지금 {fakeLiveCount}명 접속중
          </span>
        </div>
      </section>

      <SectionDivider />

      <section className="px-4 py-6 bg-gradient-to-b from-red-500/8 to-transparent dark:from-red-500/6 dark:to-transparent">
        <div className="flex items-start gap-2 mb-3">
          <span className="shrink-0 size-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 dark:text-red-400" aria-hidden>
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">
              LA 20·30 자영업·스타트업 응원해요
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              청춘들의 비즈니스를 소개하고 함께 응원해요.
            </p>
          </div>
        </div>
        {businessSpotlight.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory -mx-1">
            {businessSpotlight.map((b) => {
              const href = b.link_url?.trim()
              const websiteUrl = href?.startsWith('http') ? href : href ? `https://${href}` : null
              const instaHref = b.instagram_url?.trim()
              const instaUrl = instaHref?.startsWith('http') ? instaHref : instaHref ? `https://${instaHref}` : null
              const primaryUrl = websiteUrl ?? instaUrl
              const cardClass = 'shrink-0 snap-start w-[160px] rounded-xl border border-border bg-card overflow-hidden hover:bg-muted/50 transition-colors'
              const mediaUrl = getBusinessSpotlightMediaUrl(b.media_path)
              const topBlock = (
                <>
                  {mediaUrl && (
                    <div className="relative w-full aspect-[4/3] bg-muted">
                      {b.media_type === 'video' ? (
                        <video src={mediaUrl} className="w-full h-full object-cover" muted playsInline />
                      ) : (
                        <Image src={mediaUrl} alt="" fill className="object-cover" sizes="160px" />
                      )}
                    </div>
                  )}
                  <div className="p-3 pt-2">
                    <p className="text-sm font-medium text-foreground truncate">{b.business_name}</p>
                    {b.one_liner && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.one_liner}</p>
                    )}
                  </div>
                </>
              )
              return (
                <div key={b.id} className={cardClass}>
                  {primaryUrl ? (
                    <Link href={primaryUrl} target="_blank" rel="noopener noreferrer" className="block">
                      {topBlock}
                    </Link>
                  ) : (
                    topBlock
                  )}
                  <div className="px-3 pb-3 flex flex-wrap items-center gap-1">
                    {websiteUrl && (
                      <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-red-500 dark:text-red-400 hover:bg-red-500/10">
                        <ExternalLink className="size-3 shrink-0" /> 웹사이트
                      </a>
                    )}
                    {instaUrl && (
                      <a href={instaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-red-500 dark:text-red-400 hover:bg-red-500/10">
                        <InstagramIcon className="size-3 shrink-0" /> 인스타
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          {user && hasRegisteredBusiness ? (
            <span className="text-sm text-muted-foreground">이미 비즈니스를 등록하셨습니다.</span>
          ) : (
            <Button variant="outline" size="sm" className="rounded-full border-red-500/40 text-red-500 dark:text-red-400 hover:bg-red-500/10" asChild>
              <Link href="/support">비즈니스 소개하기</Link>
            </Button>
          )}
          {businessSpotlight.length > 0 && (
            <Link href="/support" className="text-xs text-muted-foreground hover:text-foreground">
              더 보기
            </Link>
          )}
        </div>
      </section>

      <SectionDivider />

      {popularMembers.length > 0 && (
        <section className="px-4 py-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">인기 멤버</h2>
            <span className="text-xs text-muted-foreground">이번 주 기준</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory shrink-0">
            {popularMembers.map((m) => (
              <Link
                key={m.user_id}
                href={`/u/${m.user_id}`}
                className="shrink-0 flex flex-col items-center gap-1.5 snap-start w-16 rounded-xl p-1 hover:bg-muted/50 transition-colors"
              >
                <div className={`size-12 rounded-full flex items-center justify-center text-xl overflow-visible shadow-sm ${!m.avatar_url ? m.colorClass : 'relative'}`}>
                  {m.avatar_url ? (
                    <>
                      <div className={`absolute inset-0 rounded-full ${m.colorClass}`} aria-hidden />
                      <div className="relative size-9 rounded-full overflow-hidden bg-background ring-2 ring-background">
                        <Image src={m.avatar_url} alt="" width={36} height={36} className="w-full h-full object-cover" />
                      </div>
                    </>
                  ) : (
                    userAvatarEmoji(m.user_id)
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground text-center truncate w-full">{m.anon_name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <SectionDivider />

      <div id="feed-filters" className="flex gap-3 px-4 py-4 overflow-x-auto shrink-0 scroll-smooth">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedFilter(f.id)}
            className={`flex shrink-0 flex-col items-center gap-1.5 rounded-full p-3 min-w-[56px] transition-colors ${selectedFilter === f.id ? 'bg-foreground text-background ring-2 ring-foreground/20' : 'bg-muted/70 text-muted-foreground hover:bg-muted'}`}
            aria-label={f.label}
            aria-pressed={selectedFilter === f.id}
          >
            <span className="text-xl leading-none" aria-hidden>{f.icon ?? '📋'}</span>
            <span className="text-[11px] font-medium leading-tight">{f.label}</span>
          </button>
        ))}
      </div>

      <SectionDivider />

      {initialLoading && posts.length === 0 && (
        <ul>
          {[1, 2, 3].map((i) => <PostCardSkeleton key={i} />)}
        </ul>
      )}
      {!initialLoading && posts.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">
          아직 글이 없어.
        </div>
      )}
      {!initialLoading && posts.length > 0 && filteredPosts.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">
          SPICY 글이 없어.
        </div>
      )}

      {!initialLoading && filteredPosts.length > 0 && (
        <>
          {trendingPostsDisplay.length > 0 && (
            <section id="trending" className={`px-4 py-6 ${TRENDING_GRADIENT}`} aria-label="인기 글">
              <h2 className="text-base font-semibold text-foreground mb-3">LA 20·30이 많이 본 글</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {trendingPostsDisplay.map((post) => (
                  <PostGridCard
                    key={post.id}
                    post={post}
                    user={user}
                    commentCount={commentCounts[post.id] ?? 0}
                    reactionCount={reactionCounts[post.id] ?? 0}
                    postMedia={postMedia[post.id]}
                    anonName={anonMap[post.user_id] ?? '익명'}
                    avatarUrl={avatarMap[post.user_id]}
                    avatarColorClass={avatarColorMap[post.user_id]}
                  />
                ))}
              </ul>
              <SectionDivider />
            </section>
          )}
          <section className="pt-2 pb-4" aria-label="최신 글">
              <h2 className="px-4 text-sm font-semibold text-foreground mb-3">방금 올라온 글</h2>
            <ul>
              {latestPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  commentCount={commentCounts[post.id] ?? 0}
                  reactionCount={reactionCounts[post.id] ?? 0}
                  postMedia={postMedia[post.id]}
                  postFakeViews={postFakeViews}
                  anonName={anonMap[post.user_id] ?? '익명'}
                  avatarUrl={avatarMap[post.user_id]}
                  avatarColorClass={avatarColorMap[post.user_id]}
                  tierLabel={tierByUser[post.user_id]?.name ?? null}
                  tierBadgeColor={tierByUser[post.user_id]?.badge_color ?? null}
                  bestCommentPreview={bestCommentByPost[post.id]}
                />
              ))}
            </ul>
          </section>
        </>
      )}

      <div ref={sentinelRef} className="min-h-12 flex items-center justify-center py-4">
        {loadingMore && (
          <span className="text-sm text-muted-foreground">로딩 중…</span>
        )}
      </div>

      {notification && notificationsEnabled && (
        <div
          key={notificationKey}
          className="fixed bottom-20 left-4 right-4 max-w-[568px] mx-auto z-20 animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-3 rounded-full border border-border bg-background/95 backdrop-blur shadow-lg overflow-hidden py-2 pl-2 pr-1"
        >
          <div className={`shrink-0 size-9 rounded-full flex items-center justify-center text-base overflow-visible ${!notification.actorAvatarUrl ? (notification.actorAvatarColorClass || (notification.actorUserId ? userAvatarColor(notification.actorUserId) : userAvatarColor(notification.postId))) : 'relative'}`}>
            {notification.actorAvatarUrl ? (
              <>
                <div className={`absolute inset-0 rounded-full ${notification.actorAvatarColorClass || (notification.actorUserId ? userAvatarColor(notification.actorUserId) : userAvatarColor(notification.postId))}`} aria-hidden />
                <div className="relative size-7 rounded-full overflow-hidden bg-background ring-2 ring-background">
                  <Image src={notification.actorAvatarUrl} alt="" width={28} height={28} className="w-full h-full object-cover" />
                </div>
              </>
            ) : (
              notification.actorUserId ? userAvatarEmoji(notification.actorUserId) : userAvatarEmoji(notification.postId)
            )}
          </div>
          <Link
            href={`/p/${notification.postId}`}
            onClick={() => setNotification(null)}
            className="flex-1 min-w-0 py-2 text-left hover:opacity-90 transition-opacity flex items-center"
          >
            {notification.type === 'post' && (
              <p className="text-sm text-muted-foreground truncate">
                <span className="font-medium text-foreground">{notification.anonName}</span>님이 글을 작성{notification.titleSnippet ? `: ${notification.titleSnippet}` : ''}
              </p>
            )}
            {notification.type === 'comment' && (
              <p className="text-sm text-muted-foreground truncate">
                <span className="font-medium text-foreground">{notification.anonName}</span>님이 댓글을 남겼습니다{notification.commentSnippet ? `: ${notification.commentSnippet}` : ''}
              </p>
            )}
            {notification.type === 'reaction' && (
              <p className="text-sm text-muted-foreground truncate">
                <span className="font-medium text-foreground">{notification.anonName}</span>님이 {notification.reactionEmoji} 표시를 했습니다
              </p>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="shrink-0 size-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-lg leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      )}

      {writeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setWriteOpen(false)}>
          <div className="bg-background border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">글쓰기</h2>
              <Button variant="ghost" size="sm" onClick={() => setWriteOpen(false)}>닫기</Button>
            </div>
            <div className="p-4">
              <WriteForm user={user} onSuccess={handleWriteSuccess} onCancel={() => setWriteOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-20 max-w-[600px] mx-auto border-t border-border bg-background/95 backdrop-blur safe-area-pb" aria-label="Bottom menu">
        <div className="flex items-center justify-around h-14 px-2">
          <Link href="/" className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground" aria-label="Home">
            <Home className="size-5" />
            <span className="text-[10px]">홈</span>
          </Link>
          <Link href="/#trending" className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground" aria-label="Trending">
            <Flame className="size-5" />
            <span className="text-[10px]">인기</span>
          </Link>
          <button
            type="button"
            onClick={() => setWriteOpen(true)}
            className="flex flex-col items-center justify-center -mt-4 size-14 rounded-full bg-[var(--spicy)] text-white shadow-lg hover:opacity-90 transition-opacity"
            aria-label="Write post"
          >
            <Plus className="size-7 stroke-[2.5]" />
          </button>
          <Link href="/#notifications" className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground relative" aria-label="Notifications">
            <Bell className="size-5" />
            <span className="text-[10px]">알림</span>
            {notification && <span className="absolute top-1 right-1/4 size-2 rounded-full bg-destructive" />}
          </Link>
          {user ? (
            <Link href="/profile" className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground min-w-[3rem]" aria-label="Profile">
              <span className={`size-8 rounded-full flex items-center justify-center text-base overflow-visible shrink-0 ${!headerAvatarUrl ? (headerAvatarColorClass || userAvatarColor(user.id)) : 'relative'}`}>
                {headerAvatarUrl ? (
                  <>
                    <div className={`absolute inset-0 rounded-full ${headerAvatarColorClass || userAvatarColor(user.id)}`} aria-hidden />
                    <div className="relative size-6 rounded-full overflow-hidden bg-background ring-2 ring-background">
                      <Image src={headerAvatarUrl} alt="" width={24} height={24} className="w-full h-full object-cover" />
                    </div>
                  </>
                ) : (
                  userAvatarEmoji(user.id)
                )}
              </span>
              <span className="text-[10px]">프로필</span>
            </Link>
          ) : (
            <Link href="/login" className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground" aria-label="Login">
              <UserIcon className="size-5" />
              <span className="text-[10px]">로그인</span>
            </Link>
          )}
        </div>
      </nav>
      <div className="h-14 shrink-0" aria-hidden />
    </main>
  )
}
