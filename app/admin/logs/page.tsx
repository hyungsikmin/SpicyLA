'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Log = {
  id: string
  admin_id: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  report_resolve: '신고 처리',
  post_delete: '글 삭제',
  post_hide: '글 숨김',
  post_pin: '글 고정',
  post_unpin: '고정 해제',
  comment_delete: '댓글 삭제',
  user_ban: '유저 정지',
  user_unban: '정지 해제',
}

export default function AdminLogsPage() {
  const [list, setList] = useState<Log[]>([])
  const [adminNames, setAdminNames] = useState<Record<string, string>>({})
  const [postTitles, setPostTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('admin_activity_log')
      .select('id, admin_id, action, target_type, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(async ({ data }) => {
        const logs = (data ?? []) as Log[]
        setList(logs)
        const adminIds = [...new Set(logs.map((l) => l.admin_id))]
        const postIds = [...new Set(logs.filter((l) => l.target_type === 'post' && l.target_id).map((l) => l.target_id!))]
        const [profilesRes, postsRes] = await Promise.all([
          adminIds.length > 0 ? supabase.from('profiles').select('user_id, anon_name').in('user_id', adminIds) : { data: [] },
          postIds.length > 0 ? supabase.from('posts').select('id, title').in('id', postIds) : { data: [] },
        ])
        const names: Record<string, string> = {}
        ;(profilesRes.data ?? []).forEach((p: { user_id: string; anon_name: string | null }) => {
          names[p.user_id] = p.anon_name?.trim() || '익명'
        })
        setAdminNames(names)
        const titles: Record<string, string> = {}
        ;(postsRes.data ?? []).forEach((p: { id: string; title: string | null }) => {
          titles[p.id] = (p.title?.trim() || '(제목 없음)').slice(0, 50)
        })
        setPostTitles(titles)
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="text-muted-foreground">불러오는 중…</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">관리자 활동 로그</h1>
      {list.length === 0 ? (
        <p className="text-muted-foreground">기록이 없습니다.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3">일시</th>
                <th className="text-left p-3">동작</th>
                <th className="text-left p-3">대상</th>
                <th className="text-left p-3">관리자</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{new Date(l.created_at).toLocaleString('ko-KR')}</td>
                  <td className="p-3">{ACTION_LABELS[l.action] ?? l.action}</td>
                  <td className="p-3 font-mono text-xs">{l.target_type ?? '-'} {l.target_type === 'post' && l.target_id ? (postTitles[l.target_id] ?? l.target_id) : (l.target_id ?? '')}</td>
                  <td className="p-3">{adminNames[l.admin_id] ?? l.admin_id.slice(0, 8) + '…'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
