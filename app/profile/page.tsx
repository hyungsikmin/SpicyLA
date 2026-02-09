'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRef, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { userAvatarEmoji } from '@/lib/postAvatar'
import { getAvatarUrl } from '@/lib/storage'
import { fetchTiers, resolveTier, type Tier } from '@/lib/siteSettings'
import { getLunchWinCount } from '@/lib/lunch'
import { Button } from '@/components/ui/button'
import { ChevronRight, Moon, Bell, Flame, Eye, MessageCircle, Shield, LogOut } from 'lucide-react'

const AVATAR_COLORS = [
  'bg-[#fef3c7]',   /* light beige/cream - 라이트/다크 동일 */
  'bg-[#fce7f3]',   /* light pink */
  'bg-[#d1fae5]',   /* pale mint */
  'bg-[#dbeafe]',   /* light blue */
  'bg-[#e9d5ff]',   /* light lavender */
  'bg-[#ffedd5]',   /* pale peach */
]
const IRIDESCENT_CLASS = 'bg-gradient-to-br from-pink-300/80 via-purple-300/80 to-red-400/80 dark:from-pink-400/70 dark:via-purple-400/70 dark:to-red-400/70'
const SEOLJJANGI_ALERT = '이 배경은 최고 등급에게만 제공됩니다. 관리자 설정의 등급 요건을 충족하면 사용할 수 있어요.'

function generateAnonName() {
  return `익명${Math.floor(1000 + Math.random() * 9000)}`
}

type Profile = {
  anon_name: string | null
  status: string | null
  profile_color_index: number | null
  avatar_path: string | null
  lunch_winner_at: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [postsCount, setPostsCount] = useState(0)
  const [commentsCount, setCommentsCount] = useState(0)
  const [spicyCount, setSpicyCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [spicyOnly, setSpicyOnly] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [lunchWinCount, setLunchWinCount] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchTiers().then(setTiers)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login?from=/profile')
        return
      }
      setUser(data.user)
    })
  }, [router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [profileRes, postsRes, commentsRes, reactionsRes] = await Promise.all([
        supabase.from('profiles').select('anon_name, status, profile_color_index, avatar_path, lunch_winner_at').eq('user_id', user.id).maybeSingle(),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        (async () => {
          const { data: myPosts } = await supabase.from('posts').select('id').eq('user_id', user.id)
          if (!myPosts?.length) return { count: 0 }
          const ids = myPosts.map((p) => p.id)
          const { count } = await supabase.from('post_reactions').select('id', { count: 'exact', head: true }).in('post_id', ids)
          return { count: count ?? 0 }
        })(),
      ])
      let profileData = profileRes.data as Profile | null
      if (!profileData) {
        const anon = generateAnonName()
        await supabase.from('profiles').insert({ user_id: user.id, anon_name: anon })
        const { data: refetched } = await supabase.from('profiles').select('anon_name, status, profile_color_index, avatar_path, lunch_winner_at').eq('user_id', user.id).single()
        profileData = refetched as Profile
      } else if (!profileData.anon_name?.trim()) {
        const anon = generateAnonName()
        await supabase.from('profiles').update({ anon_name: anon }).eq('user_id', user.id)
        profileData = { ...profileData, anon_name: anon }
      }
      setProfile(profileData)
      setPostsCount(postsRes.count ?? 0)
      setCommentsCount(commentsRes.count ?? 0)
      setSpicyCount(typeof (reactionsRes as { count?: number }).count === 'number' ? (reactionsRes as { count: number }).count : 0)
      getLunchWinCount(user.id).then(setLunchWinCount)
      setLoading(false)
    }
    load()
  }, [user])

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'))
    try {
      setNotifications(localStorage.getItem('notifications') === 'true')
      setSpicyOnly(localStorage.getItem('spicyOnly') === 'true')
    } catch {}
  }, [])

  useEffect(() => {
    if (!profile || !user || tiers.length === 0 || profile.profile_color_index !== 6) return
    const current = resolveTier(tiers, postsCount, commentsCount, spicyCount)
    const maxOrder = Math.max(...tiers.map((t) => t.sort_order))
    if (current && current.sort_order === maxOrder) return
    supabase.from('profiles').update({ profile_color_index: 0 }).eq('user_id', user.id).then(() => {
      setProfile((p) => (p ? { ...p, profile_color_index: 0 } : null))
    })
  }, [profile, tiers, postsCount, commentsCount, spicyCount, user?.id])

  const toggleDark = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setDarkMode(next)
  }
  const toggleNotifications = () => {
    const next = !notifications
    setNotifications(next)
    try { localStorage.setItem('notifications', next ? 'true' : 'false') } catch {}
  }
  const toggleSpicyOnly = () => {
    const next = !spicyOnly
    setSpicyOnly(next)
    try { localStorage.setItem('spicyOnly', next ? 'true' : 'false') } catch {}
  }

  const handleLogout = () => {
    supabase.auth.signOut().then(() => router.replace('/'))
  }

  const currentTier = resolveTier(tiers, postsCount, commentsCount, spicyCount)
  const maxSortOrder = tiers.length ? Math.max(...tiers.map((t) => t.sort_order)) : 0
  const isTopTier = !!(currentTier && currentTier.sort_order === maxSortOrder)
  const colorIndex = profile?.profile_color_index ?? null
  const defaultColorIndex = user ? Math.abs([...user.id].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0) | 0, 0)) % 6 : 0
  const colorClass = colorIndex === 6
    ? IRIDESCENT_CLASS
    : colorIndex != null && colorIndex >= 0 && colorIndex < AVATAR_COLORS.length
      ? AVATAR_COLORS[colorIndex]
      : AVATAR_COLORS[defaultColorIndex]
  const emoji = user ? userAvatarEmoji(user.id) : '🦊'
  const avatarUrl = getAvatarUrl(profile?.avatar_path ?? null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 올릴 수 있어요.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      alert('3MB 이하로 올려주세요.')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadErr) {
      alert(uploadErr.message || '업로드 실패')
      setUploading(false)
      return
    }
    const { error: updateErr } = await supabase.from('profiles').update({ avatar_path: path }).eq('user_id', user.id)
    if (updateErr) {
      alert(updateErr.message || '저장 실패')
    } else {
      setProfile((p) => (p ? { ...p, avatar_path: path } : null))
    }
    e.target.value = ''
    setUploading(false)
  }

  const handleColorSelect = async (i: number) => {
    if (i === 6) {
      if (!isTopTier) {
        alert(SEOLJJANGI_ALERT)
        return
      }
    }
    const payload = {
      user_id: user!.id,
      profile_color_index: i,
      anon_name: profile?.anon_name?.trim() || generateAnonName(),
    }
    await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' })
    setProfile((p) => (p ? { ...p, profile_color_index: i } : { ...payload, status: null, avatar_path: null, lunch_winner_at: null }))
  }

  if (loading || !user) {
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
        <h1 className="text-lg font-semibold flex-1 min-w-0">내 프로필</h1>
      </header>

      <section className="px-4 pt-8 pb-6">
        <div className="flex flex-col items-center gap-4">
          <div className={`relative size-24 rounded-full flex items-center justify-center text-4xl overflow-visible ${!avatarUrl ? colorClass : ''}`}>
            {avatarUrl ? (
              <>
                <div className={`absolute inset-0 rounded-full ${colorClass}`} aria-hidden />
                <div className="relative size-14 rounded-full overflow-hidden bg-background ring-2 ring-background">
                  <Image src={avatarUrl} alt="" fill className="object-cover" sizes="56px" />
                </div>
              </>
            ) : (
              <span>{emoji}</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 size-8 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
              aria-label="프로필 사진 변경"
            >
              {uploading ? <span className="text-xs">…</span> : <span className="text-sm">📷</span>}
            </button>
          </div>
          {currentTier && (
            <span
              className={!currentTier.badge_color ? 'rounded-full bg-[var(--spicy)]/20 text-[var(--spicy)] text-xs font-semibold px-2.5 py-1 border border-[var(--spicy)]/40' : 'rounded-full text-xs font-semibold px-2.5 py-1 border'}
              style={currentTier.badge_color ? { color: currentTier.badge_color, backgroundColor: currentTier.badge_color + '20', borderColor: currentTier.badge_color + '40' } : undefined}
            >
              {currentTier.name}
            </span>
          )}
          {(profile?.lunch_winner_at === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) || lunchWinCount > 0) && (
            <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2.5 py-1 border border-amber-500/40">
              🍱 {profile?.lunch_winner_at === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) ? '오늘의 점메추왕' : `${lunchWinCount}회 점메추왕`}
            </span>
          )}
          <div className="flex gap-2 flex-wrap justify-center items-center">
            {AVATAR_COLORS.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleColorSelect(i)}
                className={`size-6 rounded-full ${c} ${(colorIndex ?? -1) === i ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''}`}
                aria-label={`색 ${i + 1}`}
              />
            ))}
            <button
              type="button"
              onClick={() => handleColorSelect(6)}
              className={`size-6 rounded-full ${IRIDESCENT_CLASS} ${colorIndex === 6 ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''} ${isTopTier ? 'opacity-90' : 'opacity-50'}`}
              aria-label="최고 등급 전용 배경"
              title={isTopTier ? '최고 등급 전용' : '클릭 시 안내'}
            />
          </div>
          <div className="w-full space-y-1">
            <Link href="/profile/edit" className="flex items-center justify-between py-2 group">
              <span className="font-semibold text-lg">{profile?.anon_name?.trim() || '익명'}</span>
              <ChevronRight className="size-5 text-muted-foreground group-hover:text-foreground" />
            </Link>
            <Link href="/profile/edit?tab=status" className="flex items-center justify-between py-2 text-muted-foreground group">
              <span className="text-sm">{profile?.status?.trim() || '상태메시지를 입력하세요'}</span>
              <ChevronRight className="size-5 text-muted-foreground group-hover:text-foreground" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-6 rounded-xl bg-muted/50 border border-border p-3">
          <div className="text-center">
            <p className="text-lg font-semibold tabular-nums">{postsCount}</p>
            <p className="text-xs text-muted-foreground">작성글</p>
          </div>
          <div className="text-center border-x border-border">
            <p className="text-lg font-semibold tabular-nums">{commentsCount}</p>
            <p className="text-xs text-muted-foreground">댓글</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold tabular-nums">{spicyCount}</p>
            <p className="text-xs text-muted-foreground">받은 spicy</p>
          </div>
        </div>
      </section>

      <section className="px-4 border-t border-border pt-4">
        <h2 className="text-sm font-semibold text-muted-foreground px-1 mb-3">설정</h2>
        <div className="rounded-xl border border-border divide-y divide-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground shrink-0">연결된 계정</span>
            <span className="flex-1 text-sm text-foreground truncate" title={user.email ?? undefined}>
              {user.email ? `Google (${user.email})` : 'Google'}
            </span>
          </div>
          <button type="button" onClick={toggleDark} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
            <Moon className="size-5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium">다크 모드</span>
            <span className={`inline-flex h-6 w-11 shrink-0 rounded-full border border-border transition-colors ${darkMode ? 'bg-foreground' : 'bg-muted'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform mt-0.5 ml-0.5 ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </span>
          </button>
          <button type="button" onClick={toggleNotifications} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
            <Bell className="size-5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium">알림</span>
            <span className={`inline-flex h-6 w-11 shrink-0 rounded-full border border-border transition-colors ${notifications ? 'bg-foreground' : 'bg-muted'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform mt-0.5 ml-0.5 ${notifications ? 'translate-x-5' : 'translate-x-0'}`} />
            </span>
          </button>
          <button type="button" onClick={toggleSpicyOnly} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
            <Flame className="size-5 text-[var(--spicy)] shrink-0" />
            <div className="flex-1 text-left">
              <span className="text-sm font-medium block">SPICY 글만 보기</span>
              <span className="text-xs text-muted-foreground">매운 글만 피드에 표시</span>
            </div>
            <span className={`inline-flex h-6 w-11 shrink-0 rounded-full border border-border transition-colors ${spicyOnly ? 'bg-foreground' : 'bg-muted'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform mt-0.5 ml-0.5 ${spicyOnly ? 'translate-x-5' : 'translate-x-0'}`} />
            </span>
          </button>
        </div>
      </section>

      <section className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground px-1 mb-3">내 활동</h2>
        <div className="rounded-xl border border-border divide-y divide-border">
          <Link href="/profile/posts" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <Eye className="size-5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium">내가 쓴 글</span>
            <span className="text-muted-foreground text-sm tabular-nums">{postsCount}</span>
            <ChevronRight className="size-5 text-muted-foreground shrink-0" />
          </Link>
          <Link href="/profile/comments" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <MessageCircle className="size-5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium">내가 쓴 댓글</span>
            <span className="text-muted-foreground text-sm tabular-nums">{commentsCount}</span>
            <ChevronRight className="size-5 text-muted-foreground shrink-0" />
          </Link>
          <Link href="/profile/blocked" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <Shield className="size-5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium">차단 관리</span>
            <ChevronRight className="size-5 text-muted-foreground shrink-0" />
          </Link>
        </div>
      </section>

      <section className="px-4 mt-8">
        <Button variant="destructive" className="w-full rounded-xl gap-2" onClick={handleLogout}>
          <LogOut className="size-4" />
          로그아웃
        </Button>
      </section>

      <p className="text-center text-xs text-muted-foreground mt-8">아니근데 v1.0.0</p>
    </main>
  )
}
