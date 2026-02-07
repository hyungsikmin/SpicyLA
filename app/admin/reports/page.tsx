'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ExternalLink, UserX, Eye, EyeOff, Trash2, CheckCircle } from 'lucide-react'
import { logAdminAction } from '@/lib/adminLog'

type Report = {
  id: string
  target_type: string | null
  target_id: string | null
  reason: string | null
  created_at: string
  resolved_at: string | null
  reporter_id: string | null
}

export default function AdminReportsPage() {
  const [list, setList] = useState<Report[]>([])
  const [commentPostIds, setCommentPostIds] = useState<Record<string, string>>({})
  const [postUserIds, setPostUserIds] = useState<Record<string, string>>({})
  const [commentUserIds, setCommentUserIds] = useState<Record<string, string>>({})
  const [reporterNames, setReporterNames] = useState<Record<string, string>>({})
  const [targetNames, setTargetNames] = useState<Record<string, string>>({})
  const [postTitles, setPostTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = () => {
    setLoading(true)
    supabase
      .from('reports')
      .select('id, target_type, target_id, reason, created_at, resolved_at, reporter_id')
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const reports = (data ?? []) as Report[]
        setList(reports)
        const commentIds = reports.filter((r) => r.target_type === 'comment' && r.target_id).map((r) => r.target_id!)
        const postIds = reports.filter((r) => r.target_type === 'post' && r.target_id).map((r) => r.target_id!)
        const reporterIds = [...new Set(reports.map((r) => r.reporter_id).filter(Boolean) as string[])]
        const [commentsRes, postsRes, profilesRes] = await Promise.all([
          commentIds.length > 0 ? supabase.from('comments').select('id, post_id, user_id').in('id', commentIds) : { data: [] },
          postIds.length > 0 ? supabase.from('posts').select('id, user_id, title').in('id', postIds) : { data: [] },
          reporterIds.length > 0 ? supabase.from('profiles').select('user_id, anon_name').in('user_id', reporterIds) : { data: [] },
        ])
        const postMap: Record<string, string> = {}
        const commentUserMap: Record<string, string> = {}
        ;(commentsRes.data ?? []).forEach((c: { id: string; post_id: string; user_id: string }) => {
          postMap[c.id] = c.post_id
          commentUserMap[c.id] = c.user_id
        })
        setCommentPostIds(postMap)
        setCommentUserIds(commentUserMap)
        const postUserMap: Record<string, string> = {}
        const titles: Record<string, string> = {}
        ;(postsRes.data ?? []).forEach((p: { id: string; user_id: string; title: string | null }) => {
          postUserMap[p.id] = p.user_id
          titles[p.id] = (p.title?.trim() || '(제목 없음)').slice(0, 50)
        })
        setPostUserIds(postUserMap)
        const postIdsFromComments = [...new Set(Object.values(postMap))]
        const needTitles = postIdsFromComments.filter((id) => !titles[id])
        if (needTitles.length > 0) {
          const { data: morePosts } = await supabase.from('posts').select('id, title').in('id', needTitles)
          ;(morePosts ?? []).forEach((p: { id: string; title: string | null }) => {
            titles[p.id] = (p.title?.trim() || '(제목 없음)').slice(0, 50)
          })
        }
        setPostTitles(titles)
        const names: Record<string, string> = {}
        ;(profilesRes.data ?? []).forEach((p: { user_id: string; anon_name: string | null }) => { names[p.user_id] = p.anon_name?.trim() || '익명' })
        setReporterNames(names)
        const targetUserIds = [...new Set([...Object.values(postUserMap), ...Object.values(commentUserMap), ...reports.filter((r) => r.target_type === 'user' && r.target_id).map((r) => r.target_id!)])]
        if (targetUserIds.length > 0) {
          const { data: targetProfiles } = await supabase.from('profiles').select('user_id, anon_name').in('user_id', targetUserIds)
          const tNames: Record<string, string> = {}
          ;(targetProfiles ?? []).forEach((p: { user_id: string; anon_name: string | null }) => {
            tNames[p.user_id] = p.anon_name?.trim() || '익명'
          })
          setTargetNames(tNames)
        }
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [])

  const getTargetUserId = (r: Report): string | null => {
    if (r.target_type === 'user' && r.target_id) return r.target_id
    if (r.target_type === 'post' && r.target_id && postUserIds[r.target_id]) return postUserIds[r.target_id]
    if (r.target_type === 'comment' && r.target_id && commentUserIds[r.target_id]) return commentUserIds[r.target_id]
    return null
  }

  const getContentLink = (r: Report): { href: string; label: string } | null => {
    if (r.target_type === 'post' && r.target_id) return { href: `/p/${r.target_id}`, label: postTitles[r.target_id] ? `글: ${postTitles[r.target_id]}` : '해당 글로 이동' }
    if (r.target_type === 'comment' && r.target_id && commentPostIds[r.target_id]) {
      const postId = commentPostIds[r.target_id]
      return { href: `/p/${postId}`, label: postTitles[postId] ? `글(댓글): ${postTitles[postId]}` : '해당 글(댓글)로 이동' }
    }
    if (r.target_type === 'user' && r.target_id) return { href: `/u/${r.target_id}`, label: '유저 프로필' }
    return null
  }

  const handleResolve = async (reportId: string) => {
    setActing(reportId)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('reports').update({ resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null }).eq('id', reportId)
    await logAdminAction(supabase, 'report_resolve', 'report', reportId)
    setActing(null)
    load()
  }

  const handleBulkResolve = async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 처리 완료할까요?`)) return
    setActing('bulk')
    const { data: { user } } = await supabase.auth.getUser()
    for (const id of selected) {
      await supabase.from('reports').update({ resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null }).eq('id', id)
      await logAdminAction(supabase, 'report_resolve', 'report', id)
    }
    setSelected(new Set())
    setActing(null)
    load()
  }

  const handleBanUser = async (userId: string) => {
    if (!confirm('이 유저를 사이트에서 정지할까요?')) return
    setActing(userId)
    await supabase.from('site_bans').insert({ user_id: userId, reason: '신고에 의한 정지' })
    await logAdminAction(supabase, 'user_ban', 'user', userId)
    setActing(null)
    load()
  }

  const handleHidePost = async (postId: string) => {
    if (!confirm('이 게시글을 숨김 처리할까요?')) return
    setActing(postId)
    await supabase.from('posts').update({ status: 'hidden' }).eq('id', postId)
    await logAdminAction(supabase, 'post_hide', 'post', postId)
    setActing(null)
    load()
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('이 게시글을 완전히 삭제할까요?')) return
    setActing(postId)
    await supabase.from('posts').delete().eq('id', postId)
    await logAdminAction(supabase, 'post_delete', 'post', postId)
    setActing(null)
    load()
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('이 댓글을 삭제할까요?')) return
    setActing(commentId)
    await supabase.from('comments').delete().eq('id', commentId)
    await logAdminAction(supabase, 'comment_delete', 'comment', commentId)
    setActing(null)
    load()
  }

  const filtered = filter === 'unresolved' ? list.filter((r) => !r.resolved_at) : list

  if (loading && list.length === 0) return <p className="text-muted-foreground">불러오는 중…</p>

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">신고 목록</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {filter === 'unresolved' && selected.size > 0 && (
            <Button size="sm" onClick={handleBulkResolve} disabled={!!acting}>
              선택 처리 완료 ({selected.size})
            </Button>
          )}
          <span className="text-sm text-muted-foreground">필터:</span>
          <button
            type="button"
            onClick={() => setFilter('unresolved')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === 'unresolved' ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/80'}`}
          >
            미처리 ({list.filter((r) => !r.resolved_at).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === 'all' ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/80'}`}
          >
            전체
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">{filter === 'unresolved' ? '미처리 신고가 없습니다.' : '신고가 없습니다.'}</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const contentLink = getContentLink(r)
            const targetUserId = getTargetUserId(r)
            return (
              <div key={r.id} className={`rounded-xl border p-4 ${r.resolved_at ? 'border-border bg-muted/20' : 'border-border bg-card'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!r.resolved_at && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => setSelected((prev) => { const n = new Set(prev); e.target.checked ? n.add(r.id) : n.delete(r.id); return n })}
                        className="rounded border-border"
                      />
                    )}
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('ko-KR')}</span>
                    <span className="text-xs font-medium text-muted-foreground">대상: {r.target_type ?? '-'}</span>
                    {r.reporter_id && (
                      <span className="text-xs text-muted-foreground">신고자: {reporterNames[r.reporter_id] ?? '익명'}</span>
                    )}
                    {targetUserId && (
                      <span className="text-xs text-muted-foreground">대상: {targetNames[targetUserId] ?? '익명'}</span>
                    )}
                    {r.resolved_at && (
                      <span className="text-xs text-green-600 dark:text-green-400">처리 완료</span>
                    )}
                  </div>
                  {contentLink && (
                    <Link href={contentLink.href} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1">
                        <ExternalLink className="size-3.5" /> {contentLink.label}
                      </Button>
                    </Link>
                  )}
                </div>
                <p className="text-sm text-foreground mb-3">{r.reason || '(사유 없음)'}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {targetUserId && (
                    <>
                      <Link href={`/u/${targetUserId}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1">대상 유저 프로필</Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleBanUser(targetUserId)}
                        disabled={acting === targetUserId}
                      >
                        <UserX className="size-3.5" /> 유저 차단
                      </Button>
                    </>
                  )}
                  {r.target_type === 'post' && r.target_id && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleHidePost(r.target_id!)} disabled={!!acting}>
                        <EyeOff className="size-3.5" /> 글 숨김
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeletePost(r.target_id!)} disabled={!!acting}>
                        <Trash2 className="size-3.5" /> 글 삭제
                      </Button>
                    </>
                  )}
                  {r.target_type === 'comment' && r.target_id && (
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteComment(r.target_id!)} disabled={!!acting}>
                      <Trash2 className="size-3.5" /> 댓글 삭제
                    </Button>
                  )}
                  {!r.resolved_at && (
                    <Button variant="outline" size="sm" className="gap-1 ml-auto" onClick={() => handleResolve(r.id)} disabled={!!acting}>
                      <CheckCircle className="size-3.5" /> 처리 완료
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
