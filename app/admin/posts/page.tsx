'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { logAdminAction } from '@/lib/adminLog'

type Post = {
  id: string
  user_id: string
  title: string | null
  body: string
  status: string
  is_spicy: boolean
  pinned_at: string | null
  created_at: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'visible', label: '공개' },
  { value: 'hidden', label: '숨김' },
] as const

export default function AdminPostsPage() {
  const [list, setList] = useState<Post[]>([])
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = () => {
    setLoading(true)
    let q = supabase
      .from('posts')
      .select('id, user_id, title, body, status, is_spicy, pinned_at, created_at')
      .order('created_at', { ascending: false })
      .limit(150)
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (search.trim()) {
      q = q.or(`title.ilike.%${search.trim()}%,body.ilike.%${search.trim()}%`)
    }
    q.then(async ({ data }) => {
      const posts = (data ?? []) as Post[]
      setList(posts)
      const userIds = [...new Set(posts.map((p) => p.user_id))]
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds)
        const names: Record<string, string> = {}
        ;(profiles ?? []).forEach((p: { user_id: string; anon_name: string | null }) => {
          names[p.user_id] = p.anon_name?.trim() || '익명'
        })
        setAuthorNames(names)
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    const t = setTimeout(() => load(), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [statusFilter, search])

  const handleDelete = async (id: string) => {
    if (!confirm('이 게시글을 삭제할까요?')) return
    setActing(id)
    await supabase.from('posts').delete().eq('id', id)
    await logAdminAction(supabase, 'post_delete', 'post', id)
    setActing(null)
    load()
  }

  const handleHide = async (id: string) => {
    if (!confirm('이 게시글을 숨김 처리할까요?')) return
    setActing(id)
    await supabase.from('posts').update({ status: 'hidden' }).eq('id', id)
    await logAdminAction(supabase, 'post_hide', 'post', id)
    setActing(null)
    load()
  }

  const handleUnhide = async (id: string) => {
    setActing(id)
    await supabase.from('posts').update({ status: 'visible' }).eq('id', id)
    await logAdminAction(supabase, 'post_unhide', 'post', id)
    setActing(null)
    load()
  }

  const handlePin = async (id: string) => {
    setActing(id)
    await supabase.from('posts').update({ pinned_at: new Date().toISOString() }).eq('id', id)
    await logAdminAction(supabase, 'post_pin', 'post', id)
    setActing(null)
    load()
  }

  const handleUnpin = async (id: string) => {
    setActing(id)
    await supabase.from('posts').update({ pinned_at: null }).eq('id', id)
    await logAdminAction(supabase, 'post_unpin', 'post', id)
    setActing(null)
    load()
  }

  const handleBulkHide = async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 숨김 처리할까요?`)) return
    setActing('bulk')
    for (const id of selected) {
      await supabase.from('posts').update({ status: 'hidden' }).eq('id', id)
      await logAdminAction(supabase, 'post_hide', 'post', id)
    }
    setSelected(new Set())
    setActing(null)
    load()
  }

  const handleBulkUnhide = async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 공개로 전환할까요?`)) return
    setActing('bulk')
    for (const id of selected) {
      await supabase.from('posts').update({ status: 'visible' }).eq('id', id)
      await logAdminAction(supabase, 'post_unhide', 'post', id)
    }
    setSelected(new Set())
    setActing(null)
    load()
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 삭제할까요? 복구할 수 없습니다.`)) return
    setActing('bulk')
    for (const id of selected) {
      await supabase.from('posts').delete().eq('id', id)
      await logAdminAction(supabase, 'post_delete', 'post', id)
    }
    setSelected(new Set())
    setActing(null)
    load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">게시글 관리</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="search"
            placeholder="제목·본문 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === opt.value ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/80'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleBulkHide} disabled={!!acting}>선택 숨김 ({selected.size})</Button>
          <Button size="sm" variant="outline" onClick={handleBulkUnhide} disabled={!!acting}>선택 공개 ({selected.size})</Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={!!acting}>선택 삭제 ({selected.size})</Button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-muted-foreground hover:underline">선택 해제</button>
        </div>
      )}
      {loading && list.length === 0 ? (
        <p className="text-muted-foreground">불러오는 중…</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">게시글이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <div
              key={p.id}
              className={`rounded-lg border p-4 flex flex-col gap-2 ${p.status === 'hidden' ? 'border-red-400/60 bg-red-500/10 dark:bg-red-950/30 dark:border-red-500/50' : 'border-border'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={(e) => setSelected((prev) => { const n = new Set(prev); e.target.checked ? n.add(p.id) : n.delete(p.id); return n })}
                    className="rounded border-border mt-1"
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {p.title || '(제목 없음)'}
                      {p.pinned_at && <span className="ml-1 text-red-500 dark:text-red-400 text-xs">📌 고정</span>}
                      {p.status === 'hidden' && <span className="ml-1.5 inline-flex items-center rounded bg-red-500/20 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">비공개</span>}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {authorNames[p.user_id] ?? '익명'}
                      {' · '}
                      <Link href={`/u/${p.user_id}`} target="_blank" rel="noopener noreferrer" className="text-red-500 dark:text-red-400 hover:underline">프로필</Link>
                      {' · '}{new Date(p.created_at).toLocaleString('ko-KR')} · 상태: {p.status}
                      {p.is_spicy && ' · 🌶️'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Link href={`/p/${p.id}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">글 보기</Button>
                  </Link>
                  {p.pinned_at ? (
                    <Button variant="outline" size="sm" onClick={() => handleUnpin(p.id)} disabled={!!acting}>고정 해제</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handlePin(p.id)} disabled={!!acting}>상단 고정</Button>
                  )}
                  {p.status === 'hidden' ? (
                    <Button variant="outline" size="sm" onClick={() => handleUnhide(p.id)} disabled={acting === p.id || acting === 'bulk'}>공개로 전환</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleHide(p.id)} disabled={acting === p.id || acting === 'bulk'}>숨김</Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)} disabled={acting === p.id || acting === 'bulk'}>삭제</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
