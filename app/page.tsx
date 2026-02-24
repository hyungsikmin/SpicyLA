'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { MessageCircle, Eye, Sun, Moon, Plus, Flame, Bell, User as UserIcon, Home, Sparkles, ExternalLink, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { getPostImageUrl, getAvatarUrl, getBusinessSpotlightMediaUrl } from '@/lib/storage'
import { getAvatarColorClass } from '@/lib/avatarColors'
import { userAvatarEmoji } from '@/lib/postAvatar'
import { fetchSiteSettings, fetchTiers, resolveTier, getBannerRotationSeconds, type SiteSettings, type Tier } from '@/lib/siteSettings'
import { getLunchHallOfFame, getTodayLunchParticipantCount, type HallOfFameEntry } from '@/lib/lunch'
import RelativeTime from '@/components/RelativeTime'
import WriteForm from '@/components/WriteForm'
import LunchSection from '@/components/LunchSection'
import PollBlock, { type PollData } from '@/components/PollBlock'
import ProconBar from '@/components/ProconBar'
import BannerAd from '@/components/BannerAd'
import { getSwitchSeedAccountLink } from '@/app/actions/switchSeedAccount'
import SiriOrb from '@/components/smoothui/siri-orb'
import AnimatedAvatarGroup, { type AvatarData } from '@/components/ui/smoothui/animated-avatar-group'

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
const DEFAULT_TRENDING_MAX = 10
const DEFAULT_BEST_COMMENT_MIN_LIKES = 1
const DEFAULT_SEOLJJANGI_MIN_POSTS = 2

const FILTERS = [
  { id: 'all', label: '전체', icon: '📋' },
  { id: 'story', label: '썰', icon: '🔥' },
  { id: 'love', label: '럽', icon: '❣️' },
  { id: 'eat', label: '먹', icon: '🍴' },
  { id: 'work', label: '일', icon: '💻' },
  { id: 'money', label: '돈', icon: '💰' },
  { id: 'home', label: '집', icon: '🏠' },
  { id: 'travel', label: '여', icon: '🏝️' },
  { id: 'question', label: '질', icon: '⁉️' },
] as const
/** 피드·4칼럼 공통 순서: 전체-썰-럽-먹-일-돈-집-여-질 */
const FILTER_ORDER: (typeof FILTERS)[number]['id'][] = ['all', 'story', 'love', 'eat', 'work', 'money', 'home', 'travel', 'question']
const REACTION_EMOJI: Record<string, string> = {
  laugh: '🤣', angry: '😡', mindblown: '🤯', eyes: '👀', chili: '🌶️',
}
const LA_TZ = 'America/Los_Angeles'
function isTodayLA(isoDateStr: string): boolean {
  const d = new Date(isoDateStr)
  const today = new Date()
  return d.toLocaleDateString('en-CA', { timeZone: LA_TZ }) === today.toLocaleDateString('en-CA', { timeZone: LA_TZ })
}
const EMOJI_AVATAR_BG: Record<string, string> = {
  'bg-[#fef3c7]': '#fef3c7',
  'bg-[#fce7f3]': '#fce7f3',
  'bg-[#d1fae5]': '#d1fae5',
  'bg-[#dbeafe]': '#dbeafe',
  'bg-[#e9d5ff]': '#e9d5ff',
  'bg-[#ffedd5]': '#ffedd5',
}
function makeEmojiAvatarDataUrl(userId: string, colorClass: string): string {
  const emoji = userAvatarEmoji(userId)
  const bg = EMOJI_AVATAR_BG[colorClass] || '#f3f4f6'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="${bg}"/><text x="18" y="22" font-size="18" text-anchor="middle">${emoji}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
// 자영업 섹션과 비슷한 채도 (from-red-500/8 수준)
const TRENDING_GRADIENT = 'bg-gradient-to-b from-red-500/8 to-transparent dark:from-red-500/6 dark:to-transparent'
const BUSINESS_GRADIENT = 'bg-gradient-to-b from-pink-400/8 via-purple-400/6 to-transparent dark:from-pink-500/6 dark:to-transparent'
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

/** 스켈레톤: 인기 글 2칼럼 그리드 형태 */
function TrendingSectionSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse" aria-hidden>
      {[0, 1].map((col) => (
        <div key={col} className="flex-1 min-w-0 basis-0 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden p-3 space-y-2">
              <div className="flex gap-2">
                <div className="shrink-0 size-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="h-3 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-full max-w-[85%]" />
                </div>
              </div>
              <div className="h-3 bg-muted rounded w-12" />
            </div>
          ))}
        </div>
      ))}
    </div>
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
    const setVisibleOnce = () => setVisible(true)
    const obs = new IntersectionObserver(([e]) => e?.isIntersecting && setVisibleOnce(), { rootMargin: '120px', threshold: 0 })
    obs.observe(el)
    let cancelled = false
    const fallback = () => {
      if (cancelled || !el.isConnected) return
      requestAnimationFrame(() => {
        if (cancelled || !el.isConnected) return
        const rect = el.getBoundingClientRect()
        const inView = rect.top < (typeof window !== 'undefined' ? window.innerHeight : 0) + 100 && rect.bottom > -100
        if (inView) setVisibleOnce()
      })
    }
    const t = setTimeout(fallback, 150)
    return () => {
      cancelled = true
      clearTimeout(t)
      obs.disconnect()
    }
  }, [])
  return (
    <div ref={ref} className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'} ${className ?? ''}`}>
      {children}
    </div>
  )
}

function PostCard({
  post, user, commentCount, reactionCount, postMedia, postFakeViews, anonName, avatarUrl, avatarColorClass, tierLabel, tierBadgeColor, bestCommentPreview, isLunchWinner, lunchWinCount, pollData, proconData, isAdminAuthor,
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
  isLunchWinner?: boolean
  lunchWinCount?: number
  pollData?: { poll: PollData; counts: number[]; userVoteIndex: number | null } | null
  proconData?: { proCount: number; conCount: number; userVote: 'pro' | 'con' | null; proLabel?: string; conLabel?: string } | null
  isAdminAuthor?: boolean
}) {
  const fakeViews = postFakeViews(post.id, commentCount, reactionCount)
  const colorClass = avatarColorClass ?? getAvatarColorClass(null, post.user_id)
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
            {isAdminAuthor ? (
              <span className="rounded-full bg-red-500/20 text-red-500 dark:text-red-400 text-[10px] font-semibold px-1.5 py-0.5 border border-red-500/40 whitespace-nowrap">
                관리자
              </span>
            ) : tierLabel ? (
              <span
                className={!tierBadgeColor ? 'rounded-full bg-[var(--spicy)]/20 text-[var(--spicy)] text-[10px] font-semibold px-1.5 py-0.5 border border-[var(--spicy)]/40 whitespace-nowrap' : 'rounded-full text-[10px] font-semibold px-1.5 py-0.5 border whitespace-nowrap'}
                style={tierBadgeColor ? { color: tierBadgeColor, backgroundColor: tierBadgeColor + '20', borderColor: tierBadgeColor + '40' } : undefined}
              >
                {tierLabel}
              </span>
            ) : null}
            {lunchWinCount != null && lunchWinCount > 0 && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5" title="점메추 명예의 전당">
                🏆 {lunchWinCount}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 flex-wrap w-full">
              <span className={`font-semibold text-sm ${isAdminAuthor ? 'text-red-500 dark:text-red-400 font-bold' : ''}`}>{anonName}</span>
              <span className="text-muted-foreground text-sm">·</span>
              <RelativeTime date={post.created_at} />
              {post.category && (() => {
                const f = FILTERS.find((x) => x.id === post.category)
                if (!f || f.id === 'all') return null
                return (
                  <span className="text-muted-foreground text-xs font-medium ml-auto shrink-0" aria-label={`카테고리: ${f.label}`}>
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
            {pollData && (
              <div className="mt-2" onClick={(e) => { e.preventDefault(); e.stopPropagation() }} role="presentation">
                <PollBlock poll={pollData.poll} counts={pollData.counts} userVoteIndex={pollData.userVoteIndex} postUserId={post.user_id} currentUserId={user?.id ?? null} compact />
              </div>
            )}
            {proconData && (
              <div className="mt-2" onClick={(e) => { e.preventDefault(); e.stopPropagation() }} role="presentation">
                <ProconBar postId={post.id} proCount={proconData.proCount} conCount={proconData.conCount} userVote={proconData.userVote} currentUserId={user?.id ?? null} compact proLabel={proconData.proLabel} conLabel={proconData.conLabel} />
              </div>
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
  post, user, commentCount, reactionCount, postMedia, anonName, avatarUrl, avatarColorClass, isLunchWinner, lunchWinCount, pollData, proconData, compactTrending, chatStyle, isLeft, isAdminAuthor,
}: {
  post: Post
  user: User | null
  commentCount: number
  reactionCount: number
  postMedia: string[] | undefined
  anonName: string
  avatarUrl?: string | null
  avatarColorClass?: string
  isLunchWinner?: boolean
  lunchWinCount?: number
  pollData?: { poll: PollData; counts: number[]; userVoteIndex: number | null } | null
  proconData?: { proCount: number; conCount: number; userVote: 'pro' | 'con' | null; proLabel?: string; conLabel?: string } | null
  /** 많이 본 글용: 투표/찬반 위젯 숨기고 이미지만, 제목 앞에 [투표]/[찬반] 표시 */
  compactTrending?: boolean
  /** 채팅 메시지 스타일: 좌우 번갈아 가며 표시 */
  chatStyle?: boolean
  /** 채팅 스타일일 때 왼쪽 정렬 여부 */
  isLeft?: boolean
  isAdminAuthor?: boolean
}) {
  const firstMedia = postMedia?.[0]
  const colorClass = avatarColorClass ?? getAvatarColorClass(null, post.user_id)
  const titleOrBody = (post.title || post.body).replace(/\s+/g, ' ').trim().slice(0, 60)
  const isSpicyBlur = post.is_spicy && !user
  const categoryFilter = post.category ? FILTERS.find((x) => x.id === post.category) : null
  const categoryLabel = categoryFilter && categoryFilter.id !== 'all' ? categoryFilter.label : null
  const trendingPrefix = compactTrending ? (pollData ? '[투표] ' : proconData ? '[찬반] ' : '') : ''
  const displayTitle = isSpicyBlur ? '멤버만 공개' : `${trendingPrefix}${titleOrBody}`
  
  // 베스트 섹션용 고정 폭 (2칼럼 기준)
  const cardWidthStyle = compactTrending ? {} : {}
  
  // 채팅 스타일 스타일링 - 이미지처럼 부드러운 둥근 모서리와 꼬리
  const chatCardClasses = chatStyle 
    ? `flex flex-col border border-border overflow-visible shadow-sm hover:shadow-md transition-shadow block ${isLeft ? 'bg-card' : 'bg-blue-500/10 dark:bg-blue-500/20'} relative`
    : 'flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow block'
  
  // 채팅 스타일일 때 둥근 모서리와 꼬리 스타일
  const chatBubbleStyle = chatStyle ? {
    borderRadius: isLeft 
      ? '16px 16px 16px 4px' // 왼쪽: 상단 둥글게, 하단 왼쪽만 작게 (꼬리 위치)
      : '16px 16px 4px 16px', // 오른쪽: 상단 둥글게, 하단 오른쪽만 작게 (꼬리 위치)
  } : {}
  
  const cardContent = (
    <div className={chatStyle ? 'relative pb-3' : ''}>
      <Link
        href={`/p/${post.id}`}
        className={chatCardClasses}
        style={{ ...cardWidthStyle, ...chatBubbleStyle }}
        aria-label={post.title || '글 보기'}
      >
        {!compactTrending && pollData && (
          <div className="p-2 shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation() }} role="presentation">
            <PollBlock poll={pollData.poll} counts={pollData.counts} userVoteIndex={pollData.userVoteIndex} postUserId={post.user_id} currentUserId={user?.id ?? null} compact />
          </div>
        )}
        {!compactTrending && proconData && (
          <div className="p-2 shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation() }} role="presentation">
            <ProconBar postId={post.id} proCount={proconData.proCount} conCount={proconData.conCount} userVote={proconData.userVote} currentUserId={user?.id ?? null} compact proLabel={proconData.proLabel} conLabel={proconData.conLabel} />
          </div>
        )}
        {/* 채팅 스타일이 아닐 때만 이미지를 위에 크게 표시 */}
        {!chatStyle && firstMedia && !isSpicyBlur && (
          <div className={`relative w-full bg-muted shrink-0 ${compactTrending ? 'h-[10rem]' : 'aspect-[4/3]'}`}>
            <Image src={firstMedia} alt="" fill className="object-cover" sizes="(max-width: 600px) 50vw, 284px" />
          </div>
        )}
        {!chatStyle && isSpicyBlur && firstMedia && (
          <div className={`relative w-full bg-muted shrink-0 ${compactTrending ? 'h-[10rem]' : 'aspect-[4/3]'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-muted-foreground/10 via-muted to-muted-foreground/5" aria-hidden />
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">🔒</div>
          </div>
        )}
        <div className={`p-3 flex flex-col gap-2 min-w-0 ${chatStyle && firstMedia ? 'flex-row items-start gap-3' : ''}`}>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-sm font-medium text-foreground line-clamp-1 leading-snug min-w-0 flex-1 truncate">
                {displayTitle}
              </p>
              {categoryLabel && categoryFilter && (
                <span className="text-xs text-muted-foreground font-medium shrink-0" aria-label={`카테고리: ${categoryLabel}`}>
                  {categoryFilter.icon} {categoryLabel}
                </span>
              )}
            </div>
            {chatStyle && post.body && (
              <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                {post.body.replace(/\s+/g, ' ').trim()}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`size-6 rounded-full flex items-center justify-center text-xs shrink-0 overflow-hidden ${!avatarUrl ? colorClass : ''}`}>
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="" width={24} height={24} className="w-full h-full object-cover" />
                    ) : (
                      userAvatarEmoji(post.user_id)
                    )}
                  </div>
                  {!compactTrending && lunchWinCount != null && lunchWinCount > 0 && (
                    <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400" title="점메추 명예의 전당">🏆{lunchWinCount}</span>
                  )}
                </div>
                {isAdminAuthor && (
                  <span className="shrink-0 rounded bg-red-500/20 text-red-500 dark:text-red-400 text-[9px] font-semibold px-1 py-0.5 border border-red-500/40">관리자</span>
                )}
                <span className={`truncate ${compactTrending ? 'text-[8px]' : 'text-xs'} ${isAdminAuthor ? 'text-red-500 dark:text-red-400 font-bold' : 'text-muted-foreground'}`} style={compactTrending ? { maxWidth: '3rem' } : undefined}>{anonName}</span>
                {isLunchWinner && <span className="shrink-0 text-[10px] font-semibold text-amber-600 dark:text-amber-400" title="오늘의 점메추왕">🍱</span>}
              </div>
              <div className={`flex items-center gap-2 text-muted-foreground tabular-nums shrink-0 ${compactTrending ? 'text-[8px]' : 'text-xs'}`}>
                <span className="flex items-center gap-0.5"><MessageCircle className={compactTrending ? 'size-2.5' : 'size-3.5'} aria-hidden />{commentCount}</span>
                <span className={`flex items-center gap-0.5 text-red-500 dark:text-red-400 font-medium ${compactTrending ? 'text-[8px]' : ''}`}>🌶️ {reactionCount}</span>
              </div>
            </div>
          </div>
          {/* 채팅 스타일일 때 오른쪽에 작은 정방형 이미지 표시 */}
          {chatStyle && firstMedia && !isSpicyBlur && (
            <div className="relative size-16 sm:size-20 rounded-lg bg-muted shrink-0 overflow-hidden">
              <Image src={firstMedia} alt="" fill className="object-cover" sizes="80px" />
            </div>
          )}
          {chatStyle && isSpicyBlur && firstMedia && (
            <div className="relative size-16 sm:size-20 rounded-lg bg-muted shrink-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-muted-foreground/10 via-muted to-muted-foreground/5" aria-hidden />
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">🔒</div>
            </div>
          )}
        </div>
      </Link>
      {chatStyle && (
        <div 
          className={`absolute bottom-0 ${isLeft ? 'left-0' : 'right-0'} pointer-events-none`}
          style={{
            [isLeft ? 'left' : 'right']: '0px',
            bottom: '-6px',
            width: '12px',
            height: '12px',
          }}
          aria-hidden="true"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className={`${isLeft ? 'scale-x-[-1]' : ''}`}
            style={{
              filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))',
            }}
          >
            <path
              d="M0 0 L12 0 Q12 6 6 12 Q0 6 0 0 Z"
              fill={isLeft ? 'hsl(var(--card))' : 'rgba(59, 130, 246, 0.1)'}
              className={isLeft ? '' : 'dark:fill-blue-500/20'}
            />
          </svg>
        </div>
      )}
    </div>
  )
  // masonry 레이아웃에서는 li 태그 없이 사용
  return cardContent
}

function SpotlightPollCard({
  spotlight,
  user,
}: {
  spotlight: { post: Post; poll: PollData; counts: number[]; userVoteIndex: number | null }
  user: User | null
}) {
  const { post, poll, counts, userVoteIndex } = spotlight
  const ended = poll.ends_at ? new Date(poll.ends_at) <= new Date() : false
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  useEffect(() => {
    if (!poll.ends_at || ended) {
      setTimeLeft(null)
      return
    }
    const update = () => {
      const deadline = new Date(poll.ends_at!).getTime()
      const now = Date.now()
      const left = Math.max(0, deadline - now)
      if (left <= 0) {
        setTimeLeft(null)
        return
      }
      const h = Math.floor(left / 3600000)
      const m = Math.floor((left % 3600000) / 60000)
      setTimeLeft(`${h}:${m.toString().padStart(2, '0')}`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [poll.ends_at, ended])

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm p-2">
      <div
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        role="presentation"
      >
        <PollBlock
          poll={poll}
          counts={counts}
          userVoteIndex={userVoteIndex}
          postUserId={post.user_id}
          currentUserId={user?.id ?? null}
          compact
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <Link
          href={`/p/${post.id}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          글 보기 →
        </Link>
        {poll.ends_at && (
          ended ? (
            <span className="text-xs font-medium text-red-500 dark:text-red-400 rounded-full px-2 py-0.5 bg-red-500/10 border border-red-500/30">
              마감
            </span>
          ) : timeLeft ? (
            <span className="text-xs text-muted-foreground">
              {timeLeft}
            </span>
          ) : null
        )}
      </div>
    </div>
  )
}

function SpotlightProconCard({
  spotlight,
  user,
}: {
  spotlight: { post: Post; proCount: number; conCount: number; userVote: 'pro' | 'con' | null; proLabel: string; conLabel: string }
  user: User | null
}) {
  const { post, proCount, conCount, userVote, proLabel, conLabel } = spotlight
  const question = (post.title ?? '').trim() || (post.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 50) || '이 글에 대한 의견'
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm p-2">
      <p className="text-xs font-medium text-foreground mb-1 line-clamp-2">{question}{question.length >= 50 ? '…' : ''}</p>
      <div
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        role="presentation"
      >
        <ProconBar
          postId={post.id}
          proCount={proCount}
          conCount={conCount}
          userVote={userVote}
          currentUserId={user?.id ?? null}
          compact
          proLabel={proLabel}
          conLabel={conLabel}
        />
      </div>
      <Link
        href={`/p/${post.id}`}
        className="mt-1 text-xs text-muted-foreground hover:text-foreground inline-block"
      >
        글 보기 →
      </Link>
    </div>
  )
}

function HomePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [postMedia, setPostMedia] = useState<Record<string, string[]>>({})
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [fakeLiveCount, setFakeLiveCount] = useState(23)
  const [fakeTypingCount, setFakeTypingCount] = useState(0)
  const [lunchParticipantCount, setLunchParticipantCount] = useState<number | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [notification, setNotification] = useState<{ type: 'comment' | 'reaction' | 'post' | 'poll_vote' | 'procon_vote' | 'comment_like'; postId: string; anonName: string; actorUserId?: string; commentSnippet?: string; reactionEmoji?: string; titleSnippet?: string; actorAvatarUrl?: string; actorAvatarColorClass?: string; proconSide?: 'pro' | 'con' } | null>(null)
  const [notificationKey, setNotificationKey] = useState(0)
  const [dark, setDark] = useState(false)
  const [writeOpen, setWriteOpen] = useState(false)
  const [region, setRegion] = useState<string>('LA')
  const [anonMap, setAnonMap] = useState<Record<string, string>>({})
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({})
  const [avatarColorMap, setAvatarColorMap] = useState<Record<string, string>>({})
  const [tierByUser, setTierByUser] = useState<Record<string, { name: string; badge_color: string | null } | null>>({})
  const [bestCommentByPost, setBestCommentByPost] = useState<Record<string, string>>({})
  const [lunchWinnerUserIds, setLunchWinnerUserIds] = useState<Set<string>>(new Set())
  const [lunchHallOfFame, setLunchHallOfFame] = useState<HallOfFameEntry[]>([])
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [headerAnonName, setHeaderAnonName] = useState<string | null>(null)
  const [trendingRowsExpanded, setTrendingRowsExpanded] = useState(false)
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(null)
  const [headerAvatarColorClass, setHeaderAvatarColorClass] = useState<string>('')
  const [recentGlobalAlarms, setRecentGlobalAlarms] = useState<Array<{ postId: string; text: string; created_at: string }>>([])
  const [buttonScrollIndex, setButtonScrollIndex] = useState(0)
  const [spicyOnly, setSpicyOnly] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('spicyOnly') === 'true' } catch { return false }
  })
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [popularMembers, setPopularMembers] = useState<Array<{ user_id: string; anon_name: string; avatar_url: string | null; colorClass: string }>>([])
  const [topActiveAvatars, setTopActiveAvatars] = useState<AvatarData[]>([])
  const [totalMemberCount, setTotalMemberCount] = useState(0)
  const [businessSpotlight, setBusinessSpotlight] = useState<Array<{ id: string; business_name: string; one_liner: string | null; link_url: string | null; instagram_url: string | null; media_path: string | null; media_type: string | null }>>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set())
  const [seedSwitchLoading, setSeedSwitchLoading] = useState(false)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [trendingPostsData, setTrendingPostsData] = useState<Post[]>([])
  const [categoryPoolPosts, setCategoryPoolPosts] = useState<Post[]>([])
  /** 카테고리 칼럼(썰/먹/일/집) 전용: 카테고리별 최신 5개를 직접 조회해 표시가 바뀌는 문제 방지 */
  const [categoryColumnPosts, setCategoryColumnPosts] = useState<Record<string, Post[]>>({})
  const [bestPollSpotlight, setBestPollSpotlight] = useState<{
    post: Post
    poll: PollData
    counts: number[]
    userVoteIndex: number | null
  } | null>(null)
  const [bestProconSpotlight, setBestProconSpotlight] = useState<{
    post: Post
    proCount: number
    conCount: number
    userVote: 'pro' | 'con' | null
    proLabel: string
    conLabel: string
  } | null>(null)
  const [pollByPostId, setPollByPostId] = useState<Record<string, { poll: PollData; counts: number[]; userVoteIndex: number | null }>>({})
  const [proconByPostId, setProconByPostId] = useState<Record<string, { proCount: number; conCount: number; userVote: 'pro' | 'con' | null; proLabel: string; conLabel: string }>>({})
  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasLoadedOnceRef = useRef(false)
  const savedScrollRef = useRef<number | null>(null)
  const [topNavVisible, setTopNavVisible] = useState(true)
  const [bottomNavVisible, setBottomNavVisible] = useState(true)

  useEffect(() => {
    const source = [...posts, ...trendingPostsData]
    if (source.length === 0) return
    setCategoryPoolPosts((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]))
      source.forEach((p) => map.set(p.id, p))
      return Array.from(map.values()).slice(-400)
    })
  }, [posts, trendingPostsData])

  /** 카테고리 칼럼 8개 → 4x2 그리드 (썰 럽 먹 일 / 돈 집 여 질) */
  const CATEGORY_COLUMN_IDS = ['story', 'love', 'eat', 'work', 'money', 'home', 'travel', 'question'] as const
  // categoryColumns effect는 fetchCountsAndThumbnails 선언 이후에 배치 (아래)

  useEffect(() => {
    let lastY = window.scrollY
    let downAccum = 0
    let upAccum = 0
    const THRESHOLD = 30

    const onScroll = () => {
      const y = window.scrollY
      const diff = y - lastY
      lastY = y

      if (diff > 0) {
        // 아래로 스크롤
        upAccum = 0           // 반대방향 누적 초기화
        downAccum += diff
        if (downAccum >= THRESHOLD) setTopNavVisible(false)
        setBottomNavVisible(true)  // 하단 네비는 즉시 표시
      } else if (diff < 0) {
        // 위로 스크롤
        downAccum = 0         // 반대방향 누적 초기화
        upAccum += -diff
        if (upAccum >= THRESHOLD) setBottomNavVisible(false)
        setTopNavVisible(true)    // 상단 네비는 즉시 표시
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const todayPostCount = useMemo(() => {
    const source = [...posts, ...trendingPostsData]
    const todayIds = new Set(source.filter((p) => isTodayLA(p.created_at)).map((p) => p.id))
    return todayIds.size
  }, [posts, trendingPostsData])

  useEffect(() => {
    getTodayLunchParticipantCount().then(setLunchParticipantCount)
  }, [])

  useEffect(() => {
    const fetchGlobalAlarms = async () => {
      const all: Array<{ postId: string; text: string; created_at: string }> = []
      
      // 최근 글 작성
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('id, user_id, created_at')
        .eq('status', 'visible')
        .order('created_at', { ascending: false })
        .limit(20)
      if (recentPosts && recentPosts.length > 0) {
        const postIds = recentPosts.map((p: { id: string }) => p.id)
        const userIds = [...new Set(recentPosts.map((p: { user_id: string }) => p.user_id))]
        const [snippetsRes, profilesRes] = await Promise.all([
          Promise.all(postIds.map((id: string) => supabase.rpc('get_post_notification_snippet', { p_post_id: id }))),
          userIds.length > 0 ? supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds) : { data: [] },
        ])
        const profileMap = new Map((profilesRes.data ?? []).map((p: { user_id: string; anon_name: string | null }) => [p.user_id, p.anon_name?.trim() || '익명']))
        for (let i = 0; i < recentPosts.length; i++) {
          const post = recentPosts[i] as { id: string; user_id: string; created_at: string }
          const snippet = snippetsRes[i]?.data as string | null
          all.push({
            postId: post.id,
            text: `${profileMap.get(post.user_id) || '익명'}님이 글을 작성${snippet ? `: ${snippet}` : ''}`,
            created_at: post.created_at,
          })
        }
      }

      // 최근 댓글
      const { data: recentComments } = await supabase
        .from('comments')
        .select('post_id, body, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (recentComments && recentComments.length > 0) {
        const userIds = [...new Set(recentComments.map((c: { user_id: string }) => c.user_id))]
        const { data: profiles } = userIds.length > 0
          ? await supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds)
          : { data: [] }
        const profileMap = new Map((profiles ?? []).map((p: { user_id: string; anon_name: string | null }) => [p.user_id, p.anon_name?.trim() || '익명']))
        for (const comment of recentComments) {
          const c = comment as { post_id: string; body: string; user_id: string; created_at: string }
          const snippet = c.body?.replace(/\s+/g, ' ').trim().slice(0, 20) + (c.body && c.body.length > 20 ? '…' : '')
          all.push({
            postId: c.post_id,
            text: `${profileMap.get(c.user_id) || '익명'}님이 댓글을 남겼습니다${snippet ? `: ${snippet}` : ''}`,
            created_at: c.created_at,
          })
        }
      }

      // 최근 반응
      const { data: recentReactions } = await supabase
        .from('post_reactions')
        .select('post_id, user_id, reaction_type, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (recentReactions && recentReactions.length > 0) {
        const userIds = [...new Set(recentReactions.map((r: { user_id: string }) => r.user_id))]
        const { data: profiles } = userIds.length > 0
          ? await supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds)
          : { data: [] }
        const profileMap = new Map((profiles ?? []).map((p: { user_id: string; anon_name: string | null }) => [p.user_id, p.anon_name?.trim() || '익명']))
        const emojiMap: Record<string, string> = { laugh: '🤣', angry: '😡', mindblown: '🤯', eyes: '👀', chili: '🌶️' }
        for (const reaction of recentReactions) {
          const r = reaction as { post_id: string; user_id: string; reaction_type: string; created_at: string }
          all.push({
            postId: r.post_id,
            text: `${profileMap.get(r.user_id) || '익명'}님이 ${emojiMap[r.reaction_type] || '🌶️'} 표시를 했습니다`,
            created_at: r.created_at,
          })
        }
      }

      // 최근 투표
      const { data: recentPollVotes } = await supabase
        .from('post_poll_votes')
        .select('post_id, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (recentPollVotes && recentPollVotes.length > 0) {
        const postIds = [...new Set(recentPollVotes.map((v: { post_id: string }) => v.post_id))]
        const userIds = [...new Set(recentPollVotes.map((v: { user_id: string }) => v.user_id))]
        const [snippetsRes, profilesRes] = await Promise.all([
          Promise.all(postIds.map((id: string) => supabase.rpc('get_post_notification_snippet', { p_post_id: id }))),
          userIds.length > 0 ? supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds) : { data: [] },
        ])
        const snippetMap = new Map(postIds.map((id: string, idx: number) => [id, snippetsRes[idx]?.data as string | null]))
        const profileMap = new Map((profilesRes.data ?? []).map((p: { user_id: string; anon_name: string | null }) => [p.user_id, p.anon_name?.trim() || '익명']))
        for (const vote of recentPollVotes) {
          const v = vote as { post_id: string; user_id: string; created_at: string }
          const snippet = snippetMap.get(v.post_id)
          all.push({
            postId: v.post_id,
            text: `${profileMap.get(v.user_id) || '익명'}님이 ${snippet ? `${snippet}에 ` : ''}투표를 택했어요`,
            created_at: v.created_at,
          })
        }
      }

      // 최근 댓글 하트
      const { data: recentCommentLikes } = await supabase
        .from('comment_likes')
        .select('comment_id, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (recentCommentLikes && recentCommentLikes.length > 0) {
        const commentIds = [...new Set((recentCommentLikes as { comment_id: string }[]).map((l) => l.comment_id))]
        const { data: commentRows } = await supabase.from('comments').select('id, post_id').in('id', commentIds)
        const postIdByCommentId = new Map((commentRows ?? []).map((c: { id: string; post_id: string }) => [c.id, c.post_id]))
        const userIds = [...new Set((recentCommentLikes as { user_id: string }[]).map((l) => l.user_id))]
        const { data: profiles } = userIds.length > 0
          ? await supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds)
          : { data: [] }
        const profileMap = new Map((profiles ?? []).map((p: { user_id: string; anon_name: string | null }) => [p.user_id, p.anon_name?.trim() || '익명']))
        for (const like of recentCommentLikes) {
          const l = like as { comment_id: string; user_id: string; created_at: string }
          const postId = postIdByCommentId.get(l.comment_id)
          if (!postId) continue
          all.push({
            postId,
            text: `${profileMap.get(l.user_id) || '익명'}님이 댓글에 하트를 눌렀어요`,
            created_at: l.created_at,
          })
        }
      }

      // 최근 찬반
      const { data: recentProconVotes } = await supabase
        .from('post_procon_votes')
        .select('post_id, user_id, side, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (recentProconVotes && recentProconVotes.length > 0) {
        const postIds = [...new Set(recentProconVotes.map((v: { post_id: string }) => v.post_id))]
        const userIds = [...new Set(recentProconVotes.map((v: { user_id: string }) => v.user_id))]
        const [snippetsRes, profilesRes] = await Promise.all([
          Promise.all(postIds.map((id: string) => supabase.rpc('get_post_notification_snippet', { p_post_id: id }))),
          userIds.length > 0 ? await supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds) : { data: [] },
        ])
        const snippetMap = new Map(postIds.map((id: string, idx: number) => [id, snippetsRes[idx]?.data as string | null]))
        const profileMap = new Map((profilesRes.data ?? []).map((p: { user_id: string; anon_name: string | null }) => [p.user_id, p.anon_name?.trim() || '익명']))
        for (const vote of recentProconVotes) {
          const v = vote as { post_id: string; user_id: string; side: string; created_at: string }
          const snippet = snippetMap.get(v.post_id)
          all.push({
            postId: v.post_id,
            text: `${profileMap.get(v.user_id) || '익명'}님이 ${snippet ? `${snippet}에 ` : ''}${v.side === 'pro' ? '찬성' : '반대'}를 택했어요`,
            created_at: v.created_at,
          })
        }
      }

      // created_at 기준 정렬 후 상위 20개
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setRecentGlobalAlarms(all.slice(0, 20))
      setButtonScrollIndex(0)
    }
    fetchGlobalAlarms()
  }, [])

  useEffect(() => {
    if (recentGlobalAlarms.length === 0) return
    const interval = setInterval(() => {
      setButtonScrollIndex((prev) => (prev + 1) % recentGlobalAlarms.length)
    }, 1000)
    return () => clearInterval(interval)
  }, [recentGlobalAlarms.length])

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
    setFakeTypingCount(Math.floor(Math.random() * 35) + 3)
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

  useEffect(() => {
    const load = async () => {
      const [{ count }, { data: postsData }] = await Promise.all([
        supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
        supabase.from('posts').select('id, user_id').eq('status', 'visible').order('created_at', { ascending: false }).limit(500),
      ])
      setTotalMemberCount(count ?? 0)
      if (!postsData?.length) return
      const postIds = postsData.map((p) => p.id)
      const postIdToUserId = new Map(postsData.map((p) => [p.id, p.user_id]))
      const [reactionsRes, commentsRes] = await Promise.all([
        supabase.from('post_reactions').select('post_id').in('post_id', postIds),
        supabase.from('comments').select('user_id').in('post_id', postIds),
      ])
      const scoreByUser: Record<string, number> = {}
      postsData.forEach((p) => { scoreByUser[p.user_id] = (scoreByUser[p.user_id] ?? 0) + 1 })
      ;(reactionsRes.data ?? []).forEach((r: { post_id: string }) => {
        const uid = postIdToUserId.get(r.post_id)
        if (uid) scoreByUser[uid] = (scoreByUser[uid] ?? 0) + 1
      })
      ;(commentsRes.data ?? []).forEach((c: { user_id: string }) => {
        scoreByUser[c.user_id] = (scoreByUser[c.user_id] ?? 0) + 1
      })
      const topIds = Object.entries(scoreByUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([uid]) => uid)
      if (!topIds.length) return
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, anon_name, avatar_path, profile_color_index')
        .in('user_id', topIds)
      const order = new Map(topIds.map((id, i) => [id, i]))
      const avatarList: AvatarData[] = (profiles ?? [])
        .sort((a, b) => (order.get(a.user_id) ?? 99) - (order.get(b.user_id) ?? 99))
        .map((p: { user_id: string; anon_name: string | null; avatar_path: string | null; profile_color_index: number | null }) => {
          const imgUrl = getAvatarUrl(p.avatar_path)
          const colorClass = getAvatarColorClass(p.profile_color_index ?? null, p.user_id)
          return {
            src: imgUrl || makeEmojiAvatarDataUrl(p.user_id, colorClass),
            alt: p.anon_name?.trim() || '익명',
          }
        })
      setTopActiveAvatars(avatarList)
    }
    load()
  }, [])

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_poll_votes' }, async (payload) => {
        const uid = (payload.new as { user_id?: string })?.user_id
        const me = userIdRef.current
        if (!uid || uid === me) return
        try { if (localStorage.getItem('notifications') === 'false') return } catch {}
        const postId = (payload.new as { post_id: string }).post_id
        const [profileRes, snippetRes] = await Promise.all([
          supabase.from('profiles').select('anon_name, avatar_path, profile_color_index').eq('user_id', uid).single(),
          supabase.rpc('get_post_notification_snippet', { p_post_id: postId }),
        ])
        const p = profileRes.data as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | null
        const titleSnippet = (snippetRes.data as string | null)?.trim() || undefined
        const actorUrl = p ? getAvatarUrl(p.avatar_path ?? null) : null
        const actorColor = p ? getAvatarColorClass(p.profile_color_index ?? null, uid) : undefined
        setNotification({ type: 'poll_vote', postId, anonName: p?.anon_name?.trim() || '익명', actorUserId: uid, actorAvatarUrl: actorUrl ?? undefined, actorAvatarColorClass: actorColor, titleSnippet })
        setNotificationKey((k) => k + 1)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_procon_votes' }, async (payload) => {
        const uid = (payload.new as { user_id?: string })?.user_id
        const me = userIdRef.current
        if (!uid || uid === me) return
        try { if (localStorage.getItem('notifications') === 'false') return } catch {}
        const postId = (payload.new as { post_id: string }).post_id
        const side = (payload.new as { side?: string })?.side as 'pro' | 'con' | undefined
        const [profileRes, snippetRes] = await Promise.all([
          supabase.from('profiles').select('anon_name, avatar_path, profile_color_index').eq('user_id', uid).single(),
          supabase.rpc('get_post_notification_snippet', { p_post_id: postId }),
        ])
        const p = profileRes.data as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | null
        const titleSnippet = (snippetRes.data as string | null)?.trim() || undefined
        const actorUrl = p ? getAvatarUrl(p.avatar_path ?? null) : null
        const actorColor = p ? getAvatarColorClass(p.profile_color_index ?? null, uid) : undefined
        setNotification({ type: 'procon_vote', postId, anonName: p?.anon_name?.trim() || '익명', actorUserId: uid, actorAvatarUrl: actorUrl ?? undefined, actorAvatarColorClass: actorColor, proconSide: side, titleSnippet })
        setNotificationKey((k) => k + 1)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comment_likes' }, async (payload) => {
        const uid = (payload.new as { user_id?: string })?.user_id
        const me = userIdRef.current
        if (!uid || uid === me) return
        try { if (localStorage.getItem('notifications') === 'false') return } catch {}
        const commentId = (payload.new as { comment_id: string }).comment_id
        const { data: commentRow } = await supabase.from('comments').select('post_id').eq('id', commentId).single()
        const postId = (commentRow as { post_id?: string } | null)?.post_id
        if (!postId) return
        const { data: profile } = await supabase.from('profiles').select('anon_name, avatar_path, profile_color_index').eq('user_id', uid).single()
        const p = profile as { anon_name?: string | null; avatar_path?: string | null; profile_color_index?: number | null } | null
        const actorUrl = p ? getAvatarUrl(p.avatar_path ?? null) : null
        const actorColor = p ? getAvatarColorClass(p.profile_color_index ?? null, uid) : undefined
        setNotification({ type: 'comment_like', postId, anonName: p?.anon_name?.trim() || '익명', actorUserId: uid, actorAvatarUrl: actorUrl ?? undefined, actorAvatarColorClass: actorColor })
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
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
    fetch('/api/admin-ids')
      .then((r) => r.json())
      .then((data: { adminIds?: string[] }) => setAdminUserIds(new Set(data.adminIds ?? [])))
      .catch(() => setAdminUserIds(new Set()))
  }, [])
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

      // ── Phase 1: 기본 데이터 병렬 fetch ──
      const [reactions, comments, media, profilesRes, postsByUserRes, commentsWithBody, commentsByUserRes, allPostsByUsersRes, pollsRes, proconRes] = await Promise.all([
        supabase.from('post_reactions').select('post_id').in('post_id', postIds),
        supabase.from('comments').select('post_id').in('post_id', postIds),
        supabase.from('post_media').select('post_id, file_path, position').in('post_id', postIds).order('position'),
        uniqUserIds.length > 0 ? supabase.from('profiles').select('user_id, anon_name, avatar_path, profile_color_index, lunch_winner_at').in('user_id', uniqUserIds) : Promise.resolve({ data: [] }),
        uniqUserIds.length > 0 ? supabase.from('posts').select('user_id').in('user_id', uniqUserIds).eq('status', 'visible') : Promise.resolve({ data: [] }),
        supabase.from('comments').select('id, post_id, body').in('post_id', postIds),
        uniqUserIds.length > 0 ? supabase.from('comments').select('user_id').in('user_id', uniqUserIds) : Promise.resolve({ data: [] }),
        uniqUserIds.length > 0 ? supabase.from('posts').select('id, user_id').in('user_id', uniqUserIds).eq('status', 'visible') : Promise.resolve({ data: [] }),
        supabase.from('post_polls').select('id, post_id, question, option_1, option_2, option_3, option_4, ends_at').in('post_id', postIds),
        supabase.from('post_procon').select('post_id, pro_label, con_label').in('post_id', postIds),
      ])

      // ── Phase 2: Phase 1 결과에 의존하는 fetch들을 병렬로 ──
      const commentIds = (commentsWithBody?.data ?? []).map((c: { id: string }) => c.id)
      const allPostsByUsers = (allPostsByUsersRes.data ?? []) as { id: string; user_id: string }[]
      const allPostIds = allPostsByUsers.map((r) => r.id)
      const pollPostIds = (pollsRes.data ?? []).map((r: { post_id: string }) => r.post_id)
      const proconPostIds = (proconRes.data ?? []).map((r: { post_id: string }) => r.post_id)

      const [commentLikesRes, allReactionsRes, pollVotesRes, proconVotesRes] = await Promise.all([
        commentIds.length > 0 ? supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds) : Promise.resolve({ data: [] as { comment_id: string }[] }),
        allPostIds.length > 0 ? supabase.from('post_reactions').select('post_id').in('post_id', allPostIds) : Promise.resolve({ data: [] as { post_id: string }[] }),
        pollPostIds.length > 0 ? supabase.from('post_poll_votes').select('post_id, option_index, user_id').in('post_id', pollPostIds) : Promise.resolve({ data: [] as { post_id: string; option_index: number; user_id: string }[] }),
        proconPostIds.length > 0 ? supabase.from('post_procon_votes').select('post_id, side, user_id').in('post_id', proconPostIds) : Promise.resolve({ data: [] as { post_id: string; side: string; user_id: string }[] }),
      ])

      // ── Phase 3: 동기적으로 모든 데이터 가공 (setState 없이) ──
      const anonByUser: Record<string, string> = {}
      const avatarByUser: Record<string, string> = {}
      const colorByUser: Record<string, string> = {}
      const todayLA = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
      const newLunchWinnerIds = new Set<string>()
      profilesRes.data?.forEach((p: { user_id: string; anon_name: string | null; avatar_path?: string | null; profile_color_index?: number | null; lunch_winner_at?: string | null }) => {
        anonByUser[p.user_id] = p.anon_name?.trim() || '익명'
        const url = getAvatarUrl(p.avatar_path ?? null)
        if (url) avatarByUser[p.user_id] = url
        colorByUser[p.user_id] = getAvatarColorClass(p.profile_color_index ?? null, p.user_id)
        if (p.lunch_winner_at === todayLA) newLunchWinnerIds.add(p.user_id)
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
      const allPostIdToUserId = new Map(allPostsByUsers.map((r) => [r.id, r.user_id]))
      ;(allReactionsRes.data ?? []).forEach((r: { post_id: string }) => {
        const uid = allPostIdToUserId.get(r.post_id)
        if (uid) reactionCountByUser[uid] = (reactionCountByUser[uid] ?? 0) + 1
      })
      const newTierByUser: Record<string, { name: string; badge_color: string | null } | null> = {}
      uniqUserIds.forEach((uid) => {
        const tier = resolveTier(tiers, postCountByUser[uid] ?? 0, commentCountByUser[uid] ?? 0, reactionCountByUser[uid] ?? 0)
        newTierByUser[uid] = tier ? { name: tier.name, badge_color: tier.badge_color ?? null } : null
      })
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
      ;(commentLikesRes.data ?? []).forEach((r: { comment_id: string }) => {
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

      const currentUserId = user?.id ?? null
      const newPollByPostId: Record<string, { poll: PollData; counts: number[]; userVoteIndex: number | null }> = {}
      if (pollPostIds.length > 0) {
        const votesList = (pollVotesRes.data ?? []) as { post_id: string; option_index: number; user_id: string }[]
        for (const row of pollsRes.data ?? []) {
          const p = row as { id: string; post_id: string; question: string; option_1: string; option_2: string; option_3: string | null; option_4: string | null; ends_at: string | null }
          const votes = votesList.filter((v) => v.post_id === p.post_id)
          const counts = [0, 0, 0, 0]
          votes.forEach((v) => { if (v.option_index >= 0 && v.option_index <= 3) counts[v.option_index]++ })
          let userVoteIndex: number | null = null
          if (currentUserId) {
            const myVote = votes.find((v) => v.user_id === currentUserId)
            if (myVote != null) userVoteIndex = myVote.option_index
          }
          newPollByPostId[p.post_id] = { poll: p as PollData, counts, userVoteIndex }
        }
      }

      const newProconByPostId: Record<string, { proCount: number; conCount: number; userVote: 'pro' | 'con' | null; proLabel: string; conLabel: string }> = {}
      if (proconPostIds.length > 0) {
        const votesList = (proconVotesRes.data ?? []) as { post_id: string; side: string; user_id: string }[]
        for (const row of proconRes.data ?? []) {
          const r = row as { post_id: string; pro_label?: string | null; con_label?: string | null }
          const postId = r.post_id
          const votes = votesList.filter((v) => v.post_id === postId)
          const proCount = votes.filter((v) => v.side === 'pro').length
          const conCount = votes.filter((v) => v.side === 'con').length
          let userVote: 'pro' | 'con' | null = null
          if (currentUserId) {
            const my = votes.find((v) => v.user_id === currentUserId)
            if (my) userVote = my.side as 'pro' | 'con'
          }
          newProconByPostId[postId] = {
            proCount,
            conCount,
            userVote,
            proLabel: r.pro_label?.trim() || '찬',
            conLabel: r.con_label?.trim() || '반',
          }
        }
      }

      // ── Phase 4: 모든 setState를 한 번에 (React 18 automatic batching) ──
      setLunchWinnerUserIds((prev) => new Set([...prev, ...newLunchWinnerIds]))
      setTierByUser((prev) => ({ ...prev, ...newTierByUser }))
      setAnonMap((prev) => ({ ...prev, ...anonByUser }))
      setAvatarMap((prev) => ({ ...prev, ...avatarByUser }))
      setAvatarColorMap((prev) => ({ ...prev, ...colorByUser }))
      setBestCommentByPost((prev) => ({ ...prev, ...bestByPost }))
      setReactionCounts((prev) => ({ ...prev, ...reactionCount }))
      setCommentCounts((prev) => ({ ...prev, ...commentCount }))
      setPostMedia((prev) => ({ ...prev, ...mediaByPost }))
      setPollByPostId((prev) => ({ ...prev, ...newPollByPostId }))
      setProconByPostId((prev) => ({ ...prev, ...newProconByPostId }))
    },
    [siteSettings, tiers, user?.id]
  )

  useEffect(() => {
    let cancelled = false
    const fetchCategoryColumns = async () => {
      const results = await Promise.all(
        CATEGORY_COLUMN_IDS.map(async (catId) => {
          const { data } = await supabase
            .from('posts')
            .select('id, user_id, title, body, is_spicy, created_at, category')
            .eq('category', catId)
            .eq('status', 'visible')
            .order('created_at', { ascending: false })
            .limit(5)
          return { catId, posts: (data ?? []) as Post[] }
        })
      )
      if (cancelled) return
      const next: Record<string, Post[]> = {}
      const flat: Post[] = []
      results.forEach(({ catId, posts }) => { next[catId] = posts; flat.push(...posts) })
      if (flat.length > 0) await fetchCountsAndThumbnails(flat)
      if (cancelled) return
      setCategoryColumnPosts(next)
    }
    fetchCategoryColumns()
    return () => { cancelled = true }
  }, [fetchCountsAndThumbnails])

  useEffect(() => {
    if (siteSettings == null || tiers.length === 0) return
    const isFilterChange = hasLoadedOnceRef.current
    if (!isFilterChange) {
      setPosts([])
      setHasMore(true)
      setInitialLoading(true)
    }
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
      const filtered = blockedSet.size > 0 ? data.filter((p) => !blockedSet.has(p.user_id)) : data
      if (isFilterChange && typeof window !== 'undefined') savedScrollRef.current = window.scrollY
      await fetchCountsAndThumbnails(filtered)
      if (cancelled) return
      setBlockedIds(blockedSet)
      setPosts(filtered)
      setHasMore(filtered.length === PAGE_SIZE)
      setInitialLoading(false)
      hasLoadedOnceRef.current = true
    }
    run()
    return () => { cancelled = true }
  }, [selectedFilter, spicyOnly, fetchBatch, fetchCountsAndThumbnails, user?.id, siteSettings, tiers])

  useEffect(() => {
    if (savedScrollRef.current == null) return
    const y = savedScrollRef.current
    savedScrollRef.current = null
    requestAnimationFrame(() => { window.scrollTo(0, y) })
  }, [posts, selectedFilter])

  useEffect(() => {
    getLunchHallOfFame(10).then(setLunchHallOfFame)
  }, [])

  // Handle lunch_date query parameter - scroll to lunch section if present
  useEffect(() => {
    const lunchDate = searchParams.get('lunch_date')
    if (lunchDate && typeof window !== 'undefined') {
      // Small delay to ensure page is rendered
      setTimeout(() => {
        const lunchSection = document.getElementById('lunch')
        if (lunchSection) {
          lunchSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }, [searchParams])

  useEffect(() => {
    const minC = siteSettings?.trending_min_count ?? DEFAULT_TRENDING_MIN
    const maxC = Math.max(siteSettings?.trending_max ?? DEFAULT_TRENDING_MAX, 10)
    // 여유분으로 가져온 뒤 렌더 시 스포트라이트 ID는 별도 state로 제외 (의존성 제거로 피드와 동시 로딩)
    const adjustedMaxC = Math.max(15, maxC + 5)
    supabase.rpc('get_trending_post_ids', { p_min_count: minC, p_max_count: adjustedMaxC }).then(async ({ data: ids, error }) => {
      if (error) {
        setTrendingPostsData([])
        return
      }
      let idList = (ids ?? []) as { post_id: string }[]
      // 충분한 개수를 얻지 못한 경우, minC를 낮춰서 추가로 가져오기
      if (idList.length < adjustedMaxC && minC > 1) {
        const lowerMinC = Math.max(1, Math.floor(minC / 2))
        const needed = adjustedMaxC - idList.length
        const existingIds = new Set(idList.map(r => r.post_id))
        const fallbackRes = await supabase.rpc('get_trending_post_ids', { p_min_count: lowerMinC, p_max_count: adjustedMaxC + needed })
        if (fallbackRes.data) {
          const fallbackIds = (fallbackRes.data as { post_id: string }[]).filter(r => !existingIds.has(r.post_id))
          idList = [...idList, ...fallbackIds.slice(0, needed)]
        }
      }
      const orderIds = idList.map((r) => r.post_id)
      const { data: rows } = await supabase
        .from('posts')
        .select('id, user_id, title, body, is_spicy, created_at, category')
        .in('id', orderIds)
      const byId = new Map((rows ?? []).map((p) => [p.id, p]))
      const ordered = orderIds.map((id) => byId.get(id)).filter(Boolean) as Post[]
      if (ordered.length > 0) await fetchCountsAndThumbnails(ordered)
      setTrendingPostsData(ordered)
    })
  }, [siteSettings?.trending_min_count, siteSettings?.trending_max, fetchCountsAndThumbnails])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const [pollRes, proconRes] = await Promise.all([
        supabase.rpc('get_best_poll_post'),
        supabase.rpc('get_best_procon_post'),
      ])
      if (cancelled) return
      const pollPayload = (Array.isArray(pollRes.data) ? pollRes.data[0] : pollRes.data) as { post_id: string; total_votes: number } | null
      const proconPayload = (Array.isArray(proconRes.data) ? proconRes.data[0] : proconRes.data) as { post_id: string; total_votes: number } | null

      if (pollPayload?.post_id) {
        const postRow = await supabase.from('posts').select('id, user_id, title, body, is_spicy, created_at, category').eq('id', pollPayload.post_id).eq('status', 'visible').maybeSingle()
        if (!cancelled && postRow.data) {
          const post = postRow.data as Post
          const [pollRow, votesRow] = await Promise.all([
            supabase.from('post_polls').select('id, post_id, question, option_1, option_2, option_3, option_4, ends_at').eq('post_id', post.id).maybeSingle(),
            supabase.from('post_poll_votes').select('option_index, user_id').eq('post_id', post.id),
          ])
          if (cancelled) return
          const poll = pollRow.data as PollData | null
          const votes = (votesRow.data ?? []) as { option_index: number; user_id: string }[]
          const counts = [0, 0, 0, 0]
          votes.forEach((v) => { if (v.option_index >= 0 && v.option_index <= 3) counts[v.option_index]++ })
          let userVoteIndex: number | null = null
          if (user?.id) {
            const myVote = votes.find((v) => v.user_id === user.id)
            if (myVote != null) userVoteIndex = myVote.option_index
          }
          if (poll) {
            setBestPollSpotlight({ post, poll, counts, userVoteIndex })
          }
        }
      }

      if (proconPayload?.post_id) {
        const postRow = await supabase.from('posts').select('id, user_id, title, body, is_spicy, created_at, category').eq('id', proconPayload.post_id).eq('status', 'visible').maybeSingle()
        const proconMetaRow = await supabase.from('post_procon').select('pro_label, con_label').eq('post_id', proconPayload.post_id).maybeSingle()
        if (cancelled) return
        if (!cancelled && postRow.data) {
          const post = postRow.data as Post
          const votesRow = await supabase.from('post_procon_votes').select('side, user_id').eq('post_id', post.id)
          if (cancelled) return
          const votes = (votesRow.data ?? []) as { side: string; user_id: string }[]
          const proCount = votes.filter((v) => v.side === 'pro').length
          const conCount = votes.filter((v) => v.side === 'con').length
          let userVote: 'pro' | 'con' | null = null
          if (user?.id) {
            const my = votes.find((v) => v.user_id === user.id)
            if (my) userVote = my.side as 'pro' | 'con'
          }
          const meta = proconMetaRow.data as { pro_label?: string | null; con_label?: string | null } | null
          setBestProconSpotlight({
            post,
            proCount,
            conCount,
            userVote,
            proLabel: meta?.pro_label?.trim() || '찬',
            conLabel: meta?.con_label?.trim() || '반',
          })
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [user?.id, fetchCountsAndThumbnails])

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
  const trendingMax = Math.max(siteSettings?.trending_max ?? DEFAULT_TRENDING_MAX, 10) // 최소 10개 보장
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
  const spotlightPostIds = new Set<string>()
  if (bestPollSpotlight) spotlightPostIds.add(bestPollSpotlight.post.id)
  if (bestProconSpotlight) spotlightPostIds.add(bestProconSpotlight.post.id)
  const trendingPostsDisplay =
    trendingPostsData.length > 0
      ? trendingPostsData.filter((p) => !blockedIds.has(p.user_id) && !spotlightPostIds.has(p.id))
      : trendingFromFeed.filter((p) => !spotlightPostIds.has(p.id))
  

  
  // 방금 올라온 글에는 피드 글 전부 표시 (트렌딩에만 있는 새 글도 포함). 카테고리 선택 시 해당 카테고리 트렌딩만 병합.
  const latestPosts = useMemo(() => {
    const map = new Map(filteredPosts.map((p) => [p.id, p]))
    const toMerge = selectedFilter === 'all'
      ? trendingPostsData
      : trendingPostsData.filter((p) => p.category === selectedFilter)
    toMerge.forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, p)
    })
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [filteredPosts, trendingPostsData, selectedFilter])

  const poolForCategories =
    blockedIds.size > 0
      ? categoryPoolPosts.filter((p) => !blockedIds.has(p.user_id))
      : categoryPoolPosts
  const postsByCategory = CATEGORY_COLUMN_IDS.map((catId) => {
    const list = (categoryColumnPosts[catId] ?? [])
      .filter((p) => !blockedIds.has(p.user_id))
      .slice(0, 5)
    return { catId, posts: list }
  })
  const hasAnyCategoryPosts = postsByCategory.some((c) => c.posts.length > 0)
  const lunchWinCountByUserId: Record<string, number> = Object.fromEntries(lunchHallOfFame.map((e) => [e.user_id, e.win_count]))

  return (
    <main className="min-h-screen max-w-[600px] mx-auto bg-background pt-14">
      <header
        className="fixed top-0 left-0 right-0 z-10 max-w-[600px] mx-auto flex items-center justify-between px-4 h-14 bg-background/95 backdrop-blur-md shadow-sm"
        style={{
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          opacity: topNavVisible ? 1 : 0,
          transform: topNavVisible ? 'translateY(0)' : 'translateY(-100%)',
          pointerEvents: topNavVisible ? 'auto' : 'none',
        }}
      >
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
            <Button variant="outline" size="sm" className="rounded-full border-border text-foreground text-sm" onClick={async () => { await supabase.auth.signOut(); setUser(null); }}>
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

      <div className="px-4 py-2">
        <BannerAd slotKey="home-below-header" rotationIntervalSeconds={siteSettings ? getBannerRotationSeconds(siteSettings, 'home-below-header') : 3} />
      </div>

      <section className="rounded-t-xl px-4 py-6 space-y-3 bg-background">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm">
            20·30 👫 익명 커뮤니티
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm">
            영포티 사절🙅‍♀️
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            {fakeLiveCount}명 접속중
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            {fakeTypingCount}명 폭주중...⌨️
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            새 글 {todayPostCount}개
          </span>
          {lunchParticipantCount !== null && (
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
              점메추 {lunchParticipantCount}명 참여
            </span>
          )}
          {topActiveAvatars.length > 0 && (
            <AnimatedAvatarGroup
              avatars={topActiveAvatars}
              maxVisible={6}
              size={30}
              overlap={0.3}
              extraCount={totalMemberCount}
              showLabel
              className="ml-auto"
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => document.getElementById('feed-filters')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground hover:bg-muted/60 transition-colors relative overflow-hidden"
        >
          <div className="relative h-5">
            {recentGlobalAlarms.length > 0 ? (
              recentGlobalAlarms.map((alarm, idx) => {
                const isVisible = idx === buttonScrollIndex
                return (
                  <div
                    key={`${alarm.postId}-${alarm.created_at}-${idx}`}
                    className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                    }`}
                  >
                    <Link
                      href={`/p/${alarm.postId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate"
                    >
                      {alarm.text}
                    </Link>
                  </div>
                )
              })
            ) : (
              <span>어떤 이야기가 궁금하세요?</span>
            )}
          </div>
        </button>
      </section>

      <section id="trending" className={`rounded-t-xl -mt-3 pt-6 pb-6 px-4 min-h-[320px] ${TRENDING_GRADIENT}`} aria-label="인기 글">
          <h2 className="text-base font-semibold text-foreground mb-3">LA 20·30이 많이 본 글</h2>
          {(trendingPostsDisplay.length > 0 || hasAnyCategoryPosts || bestPollSpotlight || bestProconSpotlight) ? (
          <>
          {trendingPostsDisplay.length > 0 && (() => {
            // 2칼럼 × 3행 = 6개 (기본), 2칼럼 × 6행 = 12개 (확장)
            const maxRows = trendingRowsExpanded ? 6 : 3
            const maxCards = maxRows * 2
            const displayedPosts = trendingPostsDisplay.slice(0, maxCards)
            const hasMore = trendingPostsDisplay.length > maxCards
            
            // JavaScript로 masonry 레이아웃 계산: 각 포스트를 가장 낮은 칼럼에 배치
            const columns: Post[][] = [[], []]
            displayedPosts.forEach((post) => {
              // 각 칼럼의 높이 추정 (이미지 유무에 따라 다름)
              const columnHeights = columns.map((col: Post[]) => {
                return col.reduce((sum, p) => {
                  const hasImage = postMedia[p.id]?.[0]
                  return sum + (hasImage ? 300 : 150) // 이미지 있으면 300px, 없으면 150px 추정
                }, 0)
              })
              // 가장 낮은 칼럼에 추가
              const minHeightIndex = columnHeights[0] <= columnHeights[1] ? 0 : 1
              columns[minHeightIndex].push(post)
            })
            
            return (
              <div className="mb-5">
                <div className="flex gap-4">
                  {columns.map((columnPosts, colIndex) => (
                    <div key={colIndex} className="flex-1 min-w-0 basis-0 flex flex-col gap-4">
                      {columnPosts.map((post) => (
                        <div key={post.id}>
                          <PostGridCard
                            post={post}
                            user={user}
                            commentCount={commentCounts[post.id] ?? 0}
                            reactionCount={reactionCounts[post.id] ?? 0}
                            postMedia={postMedia[post.id]}
                            anonName={anonMap[post.user_id] ?? '익명'}
                            avatarUrl={avatarMap[post.user_id]}
                            avatarColorClass={avatarColorMap[post.user_id]}
                            isLunchWinner={lunchWinnerUserIds.has(post.user_id)}
                            lunchWinCount={lunchWinCountByUserId[post.user_id]}
                            pollData={pollByPostId[post.id]}
                            proconData={proconByPostId[post.id]}
                            compactTrending
                            isAdminAuthor={adminUserIds.has(post.user_id)}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {(hasMore || trendingRowsExpanded) && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setTrendingRowsExpanded(!trendingRowsExpanded)}
                      className="text-sm inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                      aria-label={trendingRowsExpanded ? '접기' : '더보기'}
                    >
                      더보기
                      {trendingRowsExpanded ? (
                        <ChevronUp className="size-6" aria-hidden />
                      ) : (
                        <ChevronDown className="size-6" aria-hidden />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
          {(bestPollSpotlight || bestProconSpotlight) && (
            <div className="flex flex-col gap-2 mb-5" aria-label="투표·찬반">
              {bestPollSpotlight && (
                <div className="min-w-0">
                  <SpotlightPollCard spotlight={bestPollSpotlight} user={user} />
                </div>
              )}
              {bestProconSpotlight && (
                <div className="min-w-0">
                  <SpotlightProconCard spotlight={bestProconSpotlight} user={user} />
                </div>
              )}
            </div>
          )}
          {hasAnyCategoryPosts && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3">
              {postsByCategory.map(({ catId, posts: list }) => {
                const filterMeta = FILTERS.find((f) => f.id === catId)
                const label = filterMeta?.label ?? catId
                const icon = filterMeta?.icon ?? '•'
                const scrollToLatestAndSelect = () => {
                  setSelectedFilter(catId)
                  setTimeout(() => {
                    document.getElementById('latest-posts')?.scrollIntoView({ behavior: 'smooth' })
                  }, 0)
                }
                return (
                  <div key={catId} className="min-w-0">
                    <h3 className="text-xs font-semibold text-foreground mb-0.5 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1 min-w-0 text-foreground">
                        <span className="text-muted-foreground shrink-0" aria-hidden>{icon}</span>
                        <span className="truncate">{label}</span>
                      </span>
                      <button
                        type="button"
                        onClick={scrollToLatestAndSelect}
                        className="shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`${label} 더보기`}
                      >
                        더보기
                        <ChevronRight className="size-3" aria-hidden />
                      </button>
                    </h3>
                    <div className="w-[60%] border-b border-border/40 mb-1" aria-hidden />
                    <ul className="space-y-0 divide-y divide-border/40">
                      {list.map((post) => {
                        const title = (post.title ?? '').trim() || '제목 없음'
                        const commentCount = commentCounts[post.id] ?? 0
                        return (
                          <li key={post.id} className="py-1 first:pt-0">
                            <Link
                              href={`/p/${post.id}`}
                              className="flex items-center gap-1 min-w-0 group"
                            >
                              <span className="truncate text-xs text-foreground group-hover:underline flex-1 min-w-0">
                                {title}
                              </span>
                              <span className="flex items-center gap-0.5 shrink-0 text-red-500 dark:text-red-400">
                                <Plus className="size-3" aria-hidden />
                                <span className="text-[10px] font-bold tabular-nums">{commentCount}</span>
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
          </>
          ) : (
            <TrendingSectionSkeleton />
          )}
        </section>

      <div className="px-4 py-2">
        <BannerAd slotKey="home-between-trending-lunch" rotationIntervalSeconds={siteSettings ? getBannerRotationSeconds(siteSettings, 'home-between-trending-lunch') : 3} />
      </div>

      <section id="lunch" className="min-h-[280px]" aria-label="점메추">
        <LunchSection user={user} hallOfFame={lunchHallOfFame} feedAvatarMap={avatarMap} />
      </section>

      <div className="px-4 py-2">
        <BannerAd slotKey="home-between-lunch-feed" rotationIntervalSeconds={siteSettings ? getBannerRotationSeconds(siteSettings, 'home-between-lunch-feed') : 3} />
      </div>

      <section className={`rounded-t-xl -mt-3 px-4 py-6 ${BUSINESS_GRADIENT}`}>
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

      {false && popularMembers.length > 0 && (
        <section className="rounded-t-xl -mt-3 px-4 py-6" aria-hidden>
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

      <section id="latest-posts" className="rounded-t-xl -mt-3 pt-2 pb-4 bg-background min-h-[360px]" aria-label="최신 글">
        <div className="px-4 flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground shrink-0">방금 올라온 글</h2>
          <div id="feed-filters" className="flex flex-wrap items-center gap-1.5">
            {FILTER_ORDER.map((id) => {
              const f = FILTERS.find((x) => x.id === id)
              if (!f) return null
              const isSelected = selectedFilter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSelectedFilter(f.id)
                    // Remove lunch_date from URL when category changes
                    const lunchDate = searchParams.get('lunch_date')
                    if (lunchDate) {
                      router.replace('/', { scroll: false })
                    }
                  }}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? 'bg-foreground text-background' : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  aria-label={f.label}
                  aria-pressed={isSelected}
                >
                  <span aria-hidden>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        {initialLoading && posts.length === 0 ? (
            <ul>
              {[1, 2, 3].map((i) => <PostCardSkeleton key={i} />)}
            </ul>
          ) : posts.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              아직 글이 없어.
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              이 카테고리에 글이 없어.
            </div>
          ) : (
            <ul>
              {latestPosts.flatMap((post, i) => {
                const nodes: ReactNode[] = []
                const feedBannerEvery = siteSettings?.banner_in_feed_every_n_posts ?? 5
                if (i > 0 && i % feedBannerEvery === 0) {
                  nodes.push(
                    <li key={`banner-${i}`} className="list-none">
                      <div className="px-4 py-2">
                        <BannerAd slotKey="home-in-feed" rotationIntervalSeconds={siteSettings ? getBannerRotationSeconds(siteSettings, 'home-in-feed') : 3} />
                      </div>
                    </li>
                  )
                }
                nodes.push(
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
                    isLunchWinner={lunchWinnerUserIds.has(post.user_id)}
                    lunchWinCount={lunchWinCountByUserId[post.user_id]}
                    pollData={pollByPostId[post.id]}
                    proconData={proconByPostId[post.id]}
                    isAdminAuthor={adminUserIds.has(post.user_id)}
                  />
                )
                return nodes
              })}
            </ul>
          )}
      </section>

      <div ref={sentinelRef} className="min-h-12 flex items-center justify-center py-4">
        {loadingMore && (
          <span className="text-sm text-muted-foreground">로딩 중…</span>
        )}
      </div>

      <div className="fixed bottom-14 left-0 right-0 max-w-[600px] mx-auto z-10 px-4 pointer-events-none [&_a]:pointer-events-auto">
        <BannerAd slotKey="home-bottom-sticky" rotationIntervalSeconds={siteSettings ? getBannerRotationSeconds(siteSettings, 'home-bottom-sticky') : 3} />
      </div>

      {notification && notificationsEnabled && (
        <div
          key={notificationKey}
          className="fixed bottom-20 left-4 right-4 max-w-[568px] mx-auto z-20 animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-3 rounded-full border border-border bg-background/95 backdrop-blur shadow-lg overflow-hidden py-2 pl-2 pr-1"
        >
          <div className={`shrink-0 size-9 rounded-full flex items-center justify-center text-base overflow-visible ${!notification.actorAvatarUrl ? (notification.actorAvatarColorClass || (notification.actorUserId ? getAvatarColorClass(null, notification.actorUserId) : getAvatarColorClass(null, notification.postId))) : 'relative'}`}>
            {notification.actorAvatarUrl ? (
              <>
                <div className={`absolute inset-0 rounded-full ${notification.actorAvatarColorClass || (notification.actorUserId ? getAvatarColorClass(null, notification.actorUserId) : getAvatarColorClass(null, notification.postId))}`} aria-hidden />
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
            {notification.type === 'poll_vote' && (
              <p className="text-sm text-muted-foreground truncate">
                <span className="font-medium text-foreground">{notification.anonName}</span>님이 {notification.titleSnippet ? <><span className="text-foreground/90">{notification.titleSnippet}</span>에 </> : ''}투표를 택했어요
              </p>
            )}
            {notification.type === 'procon_vote' && (
              <p className="text-sm text-muted-foreground truncate">
                <span className="font-medium text-foreground">{notification.anonName}</span>님이 {notification.titleSnippet ? <><span className="text-foreground/90">{notification.titleSnippet}</span>에 </> : ''}{notification.proconSide === 'pro' ? '찬성' : '반대'}를 택했어요
              </p>
            )}
            {notification.type === 'comment_like' && (
              <p className="text-sm text-muted-foreground truncate">
                <span className="font-medium text-foreground">{notification.anonName}</span>님이 댓글에 하트를 눌렀어요
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

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 max-w-[600px] mx-auto bg-background/95 backdrop-blur safe-area-pb shadow-[0_-2px_12px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_-2px_12px_-2px_rgba(0,0,0,0.25)]"
        style={{
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          opacity: bottomNavVisible ? 1 : 0,
          transform: bottomNavVisible ? 'translateY(0)' : 'translateY(100%)',
          pointerEvents: bottomNavVisible ? 'auto' : 'none',
        }}
        aria-label="Bottom menu"
      >
        <div className="flex items-center justify-around h-14 px-2">
          <Link href="/" className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground" aria-label="Home">
            <Home className="size-5" />
            <span className="text-[10px]">홈</span>
          </Link>
          <Link href="/#lunch" className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground" aria-label="점메추">
            <span className="size-5 flex items-center justify-center text-base" aria-hidden>🍱</span>
            <span className="text-[10px]">점메추</span>
          </Link>
          <button
            type="button"
            onClick={() => setWriteOpen(true)}
            className="flex flex-col items-center justify-center -mt-4 size-14 rounded-full shadow-lg hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spicy)] focus-visible:ring-offset-2 focus-visible:ring-offset-background relative"
            aria-label="Write post"
          >
            <SiriOrb
              size="56px"
              className="shrink-0"
              colors={{
                bg: "oklch(98% 0.01 264.695)",
                c1: "oklch(70% 0.2 120)", // Green
                c2: "oklch(75% 0.18 60)", // Yellow
                c3: "oklch(80% 0.15 300)", // Purple
              }}
              animationDuration={15}
            />
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Plus className="size-7 stroke-[2.5] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" aria-hidden />
            </span>
          </button>
          <Link href="/notifications" className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground relative" aria-label="Notifications">
            <Bell className="size-5" />
            <span className="text-[10px]">알림</span>
            {notification && (
              <span className="absolute top-0.5 right-0 flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-destructive opacity-75 animate-ping" aria-hidden />
                <span className="relative inline-flex size-2 rounded-full bg-destructive" aria-hidden />
              </span>
            )}
          </Link>
          {user ? (
            /^a\d+@gmail\.com$/i.test(user.email ?? '') ? (
              <div className="flex flex-col items-center gap-1 py-2 min-w-[3rem]">
                <Link href="/profile" className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground" aria-label="Profile">
                  <span className={`size-8 rounded-full flex items-center justify-center text-base overflow-visible shrink-0 ${!headerAvatarUrl ? (headerAvatarColorClass || getAvatarColorClass(null, user.id)) : 'relative'}`}>
                    {headerAvatarUrl ? (
                      <>
                        <div className={`absolute inset-0 rounded-full ${headerAvatarColorClass || getAvatarColorClass(null, user.id)}`} aria-hidden />
                        <div className="relative size-6 rounded-full overflow-hidden bg-background ring-2 ring-background">
                          <Image src={headerAvatarUrl} alt="" width={24} height={24} className="w-full h-full object-cover" />
                        </div>
                      </>
                    ) : (
                      userAvatarEmoji(user.id)
                    )}
                  </span>
                  <span className="text-[10px] truncate max-w-[4rem]" title={headerAnonName ?? undefined}>{headerAnonName ?? '프로필'}</span>
                </Link>
                <select
                  className="text-[9px] font-medium text-muted-foreground hover:text-foreground bg-transparent border border-border rounded px-1 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--spicy)] disabled:opacity-60 disabled:cursor-wait max-w-[3rem]"
                  value={(user.email ?? '').toLowerCase()}
                  aria-label="시드 계정 전환"
                  disabled={seedSwitchLoading}
                  onClick={(e) => e.stopPropagation()}
                  onChange={async (e) => {
                    const email = e.target.value
                    if (!email || email === user.email) return
                    const origin = typeof window !== 'undefined' ? window.location.origin : undefined
                    setSeedSwitchLoading(true)
                    try {
                      const { url, error } = await getSwitchSeedAccountLink(email, origin)
                      if (error) {
                        alert(error)
                        return
                      }
                      if (url) window.location.href = url
                    } finally {
                      setSeedSwitchLoading(false)
                    }
                  }}
                >
                  {Array.from({ length: 100 }, (_, i) => {
                    const n = i + 1
                    const em = `a${n}@gmail.com`
                    return <option key={em} value={em}>a{n}</option>
                  })}
                </select>
                <span className="text-[9px] text-muted-foreground">{seedSwitchLoading ? '전환 중…' : '계정'}</span>
              </div>
            ) : (
              <Link href="/profile" className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground min-w-[3rem]" aria-label="Profile">
                <span className={`size-8 rounded-full flex items-center justify-center text-base overflow-visible shrink-0 ${!headerAvatarUrl ? (headerAvatarColorClass || getAvatarColorClass(null, user.id)) : 'relative'}`}>
                  {headerAvatarUrl ? (
                    <>
                      <div className={`absolute inset-0 rounded-full ${headerAvatarColorClass || getAvatarColorClass(null, user.id)}`} aria-hidden />
                      <div className="relative size-6 rounded-full overflow-hidden bg-background ring-2 ring-background">
                        <Image src={headerAvatarUrl} alt="" width={24} height={24} className="w-full h-full object-cover" />
                      </div>
                    </>
                  ) : (
                    userAvatarEmoji(user.id)
                  )}
                </span>
                <span className="text-[10px] truncate max-w-[4rem]" title={headerAnonName ?? undefined}>{headerAnonName ?? '프로필'}</span>
              </Link>
            )
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

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">불러오는 중…</div>}>
      <HomePageInner />
    </Suspense>
  )
}
