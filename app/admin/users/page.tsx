'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { logAdminAction } from '@/lib/adminLog'

type Profile = {
  user_id: string
  anon_name: string | null
  status: string | null
  created_at: string
}

type BanRow = {
  user_id: string
  reason: string | null
  expires_at: string | null
  created_at: string
}

export default function AdminUsersPage() {
  const [list, setList] = useState<Profile[]>([])
  const [banMap, setBanMap] = useState<Record<string, BanRow>>({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [detailUserId, setDetailUserId] = useState<string | null>(null)
  const [detailStats, setDetailStats] = useState<{ posts: number; comments: number; reports: number } | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banExpires, setBanExpires] = useState('')

  const load = () => {
    setLoading(true)
    let q = supabase.from('profiles').select('user_id, anon_name, status, created_at').order('created_at', { ascending: false }).limit(300)
    if (search.trim()) q = q.ilike('anon_name', `%${search.trim()}%`)
    q.then(({ data: profiles }) => {
      setList((profiles ?? []) as Profile[])
      return supabase.from('site_bans').select('user_id, reason, expires_at, created_at')
    }).then(({ data: bans }) => {
      const map: Record<string, BanRow> = {}
      ;(bans ?? []).forEach((b: BanRow) => { map[b.user_id] = b })
      setBanMap(map)
      setLoading(false)
    })
  }

  useEffect(() => {
    const t = setTimeout(() => load(), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search])

  const loadDetail = async (userId: string) => {
    setDetailUserId(userId)
    setDetailStats(null)
    const [postsRes, commentsRes, reportsRes] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('target_id', userId).eq('target_type', 'user'),
    ])
    const postIds = (await supabase.from('posts').select('id').eq('user_id', userId)).data?.map((p: { id: string }) => p.id) ?? []
    const commentIds = (await supabase.from('comments').select('id').eq('user_id', userId)).data?.map((c: { id: string }) => c.id) ?? []
    const reportsOnPosts = postIds.length ? (await supabase.from('reports').select('id', { count: 'exact', head: true }).eq('target_type', 'post').in('target_id', postIds)).count ?? 0 : 0
    const reportsOnComments = commentIds.length ? (await supabase.from('reports').select('id', { count: 'exact', head: true }).eq('target_type', 'comment').in('target_id', commentIds)).count ?? 0 : 0
    setDetailStats({
      posts: postsRes.count ?? 0,
      comments: commentsRes.count ?? 0,
      reports: (reportsRes.count ?? 0) + reportsOnPosts + reportsOnComments,
    })
  }

  const handleBan = async (userId: string) => {
    const reason = banReason.trim() || '관리자 정지'
    const expiresAt = banExpires.trim() ? new Date(banExpires).toISOString() : null
    setActing(userId)
    await supabase.from('site_bans').insert({ user_id: userId, reason, expires_at: expiresAt })
    await logAdminAction(supabase, 'user_ban', 'user', userId, { reason, expires_at: expiresAt })
    setBanMap((prev) => ({ ...prev, [userId]: { user_id: userId, reason, expires_at: expiresAt, created_at: new Date().toISOString() } }))
    setBanReason('')
    setBanExpires('')
    setDetailUserId(null)
    setActing(null)
  }

  const handleUnban = async (userId: string) => {
    if (!confirm('정지를 해제할까요?')) return
    setActing(userId)
    await supabase.from('site_bans').delete().eq('user_id', userId)
    await logAdminAction(supabase, 'user_unban', 'user', userId)
    setBanMap((prev) => { const n = { ...prev }; delete n[userId]; return n })
    setDetailUserId(null)
    setActing(null)
  }

  const banned = (uid: string) => banMap[uid]
  const isBanned = (uid: string) => !!banned(uid)

  if (loading && list.length === 0) return <p className="text-muted-foreground">불러오는 중…</p>

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">유저 관리</h1>
        <input
          type="search"
          placeholder="익명 이름 검색…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {list.length === 0 ? (
        <p className="text-muted-foreground">유저가 없습니다.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3">닉네임</th>
                <th className="text-left p-3">UID</th>
                <th className="text-left p-3">상태</th>
                <th className="text-left p-3">가입일</th>
                <th className="text-left p-3">정지</th>
                <th className="text-left p-3">동작</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const ban = banned(u.user_id)
                const expired = ban?.expires_at && new Date(ban.expires_at) < new Date()
                return (
                <tr key={u.user_id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{u.anon_name?.trim() || '-'}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{u.user_id}</td>
                  <td className="p-3 truncate max-w-[120px]">{u.status ?? '-'}</td>
                  <td className="p-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="p-3">
                    {ban ? (
                      <span className={expired ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400 font-medium'}>
                        {expired ? '만료됨' : '정지'}
                        {ban.reason && ` · ${ban.reason.slice(0, 15)}`}
                        {ban.expires_at && ` ~ ${new Date(ban.expires_at).toLocaleDateString('ko-KR')}`}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-3 flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => loadDetail(u.user_id)}>상세</Button>
                    <Link href={`/u/${u.user_id}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">프로필</Button>
                    </Link>
                    {ban && !expired ? (
                      <Button variant="outline" size="sm" onClick={() => handleUnban(u.user_id)} disabled={acting === u.user_id}>정지 해제</Button>
                    ) : (
                      <Button variant="destructive" size="sm" onClick={() => loadDetail(u.user_id)} disabled={acting === u.user_id}>정지</Button>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {detailUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setDetailUserId(null); setBanReason(''); setBanExpires('') }}>
          <div className="bg-background border border-border rounded-xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">유저 상세</h3>
            <p className="font-mono text-xs text-muted-foreground mb-4">{detailUserId}</p>
            {detailStats !== null && (
              <ul className="text-sm space-y-1 mb-4">
                <li>게시글: {detailStats.posts}개</li>
                <li>댓글: {detailStats.comments}개</li>
                <li>신고당한 건수: {detailStats.reports}건</li>
              </ul>
            )}
            {(() => { const b = banned(detailUserId); const expired = b?.expires_at && new Date(b.expires_at) < new Date(); return !b || expired; })() ? (
              <div className="space-y-2 mb-4">
                <label className="block text-xs text-muted-foreground">정지 사유 (선택)</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="예: 신고에 의한 정지"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
                <label className="block text-xs text-muted-foreground">만료일 (선택, 비우면 무기한)</label>
                <input
                  type="datetime-local"
                  value={banExpires}
                  onChange={(e) => setBanExpires(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
                <div className="flex gap-2 pt-2">
                  <Button variant="destructive" size="sm" onClick={() => handleBan(detailUserId)} disabled={!!acting}>정지 처리</Button>
                  <Button variant="outline" size="sm" onClick={() => { setDetailUserId(null); setBanReason(''); setBanExpires('') }}>취소</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleUnban(detailUserId)} disabled={!!acting}>정지 해제</Button>
                <Button variant="outline" size="sm" onClick={() => { setDetailUserId(null) }}>닫기</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
