'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { logAdminAction } from '@/lib/adminLog'

type Comment = {
  id: string
  post_id: string
  user_id: string
  body: string
  parent_id: string | null
  created_at: string
}

export default function AdminCommentsPage() {
  const [list, setList] = useState<Comment[]>([])
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})
  const [postTitles, setPostTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    let q = supabase
      .from('comments')
      .select('id, post_id, user_id, body, parent_id, created_at')
      .order('created_at', { ascending: false })
      .limit(150)
    if (search.trim()) q = q.ilike('body', `%${search.trim()}%`)
    q.then(async ({ data }) => {
      const comments = (data ?? []) as Comment[]
      setList(comments)
      const userIds = [...new Set(comments.map((c) => c.user_id))]
      const postIds = [...new Set(comments.map((c) => c.post_id))]
      const [profilesRes, postsRes] = await Promise.all([
        userIds.length > 0 ? supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds) : { data: [] },
        postIds.length > 0 ? supabase.from('posts').select('id, title').in('id', postIds) : { data: [] },
      ])
      const names: Record<string, string> = {}
      ;(profilesRes.data ?? []).forEach((p: { user_id: string; anon_name: string | null }) => {
        names[p.user_id] = p.anon_name?.trim() || '익명'
      })
      setAuthorNames(names)
      const titles: Record<string, string> = {}
      ;(postsRes.data ?? []).forEach((p: { id: string; title: string | null }) => {
        titles[p.id] = (p.title?.trim() || '(제목 없음)').slice(0, 80)
      })
      setPostTitles(titles)
      setLoading(false)
    })
  }

  useEffect(() => {
    const t = setTimeout(() => load(), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search])

  const handleDelete = async (id: string) => {
    if (!confirm('이 댓글을 삭제할까요?')) return
    setDeleting(id)
    await supabase.from('comments').delete().eq('id', id)
    await logAdminAction(supabase, 'comment_delete', 'comment', id)
    setDeleting(null)
    load()
  }

  if (loading) return <p className="text-muted-foreground">불러오는 중…</p>

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">댓글 관리</h1>
        <input
          type="search"
          placeholder="댓글 내용 검색…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {list.length === 0 ? (
        <p className="text-muted-foreground">댓글이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">글: {postTitles[c.post_id] ?? '(제목 없음)'}</p>
                  <p className="text-sm">{c.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {authorNames[c.user_id] ?? '익명'}
                    {' · '}
                    <Link href={`/u/${c.user_id}`} target="_blank" rel="noopener noreferrer" className="text-red-500 dark:text-red-400 hover:underline">프로필</Link>
                    {' · '}{new Date(c.created_at).toLocaleString('ko-KR')}
                    {c.parent_id && ' · 답글'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/p/${c.post_id}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">{postTitles[c.post_id] ? `글: ${postTitles[c.post_id]}` : '글 보기'}</Button>
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)} disabled={deleting === c.id}>
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
