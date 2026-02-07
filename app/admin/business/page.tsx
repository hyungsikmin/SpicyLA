'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Trash2, ExternalLink, GripVertical } from 'lucide-react'
import { getBusinessSpotlightMediaUrl } from '@/lib/storage'

type Business = {
  id: string
  user_id: string
  business_name: string
  one_liner: string | null
  contact: string | null
  contact_private: boolean | null
  email: string | null
  email_private: boolean | null
  link_url: string | null
  instagram_url: string | null
  media_path: string | null
  media_type: string | null
  sort_order: number | null
  is_hidden: boolean
  approved: boolean | null
  created_at: string
}

export default function AdminBusinessPage() {
  const [list, setList] = useState<Business[]>([])
  const [registrantNames, setRegistrantNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    supabase
      .from('business_spotlight')
      .select('id, user_id, business_name, one_liner, contact, contact_private, email, email_private, link_url, instagram_url, media_path, media_type, sort_order, is_hidden, approved, created_at')
      .order('approved', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const rows = (data ?? []) as Business[]
        setList(rows)
        const userIds = [...new Set(rows.map((b) => b.user_id))]
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('user_id, anon_name').in('user_id', userIds)
          const names: Record<string, string> = {}
          ;(profiles ?? []).forEach((p: { user_id: string; anon_name: string | null }) => {
            names[p.user_id] = p.anon_name?.trim() || '익명'
          })
          setRegistrantNames(names)
        }
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('이 비즈니스 소개를 삭제할까요?')) return
    setDeleting(id)
    await supabase.from('business_spotlight').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  const handleToggleHidden = async (id: string, current: boolean) => {
    setUpdating(id)
    await supabase.from('business_spotlight').update({ is_hidden: !current }).eq('id', id)
    setUpdating(null)
    load()
  }

  const handleApprove = async (id: string) => {
    setUpdating(id)
    await supabase.from('business_spotlight').update({ approved: true, is_hidden: false }).eq('id', id)
    setUpdating(null)
    load()
  }

  const moveOrder = useCallback((fromId: string, toId: string) => {
    const fromIdx = list.findIndex((b) => b.id === fromId)
    const toIdx = list.findIndex((b) => b.id === toId)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
    const next = [...list]
    const [item] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, item)
    setList(next)
    setUpdating('reorder')
    Promise.all(next.map((b, i) => supabase.from('business_spotlight').update({ sort_order: i }).eq('id', b.id)))
      .then(() => { setUpdating(null); load() })
  }, [list])

  if (loading) return <p className="text-muted-foreground">불러오는 중…</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">비즈니스 스팟라이트</h1>
      {list.length === 0 ? (
        <p className="text-muted-foreground">등록된 비즈니스가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const mediaUrl = getBusinessSpotlightMediaUrl(b.media_path)
            return (
            <div
              key={b.id}
              className={`rounded-lg border border-border p-4 flex flex-col gap-3 ${draggingId === b.id ? 'opacity-60' : ''}`}
              draggable
              onDragStart={(e) => { setDraggingId(b.id); e.dataTransfer.setData('text/plain', b.id); e.dataTransfer.effectAllowed = 'move' }}
              onDragEnd={() => setDraggingId(null)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && id !== b.id) moveOrder(id, b.id) }}
            >
              <div className="flex gap-4">
                <div className="shrink-0 cursor-grab active:cursor-grabbing flex items-center text-muted-foreground" title="드래그하여 순서 변경">
                  <GripVertical className="size-4" />
                </div>
                {mediaUrl && (
                  <div className="shrink-0 w-32 aspect-video rounded-lg overflow-hidden bg-muted">
                    {b.media_type === 'video' ? (
                      <video src={mediaUrl} controls className="w-full h-full object-cover" />
                    ) : (
                      <Image src={mediaUrl} alt="" width={128} height={72} className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {b.business_name}
                    {!b.approved && <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">(검토 대기)</span>}
                    {b.is_hidden && <span className="ml-1 text-xs text-muted-foreground">(숨김)</span>}
                  </p>
                  {b.one_liner && <p className="text-sm text-muted-foreground">{b.one_liner}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    연락처: {b.contact ?? '-'}{b.contact_private ? ' (비공개)' : ''}
                    {' · '}이메일: {b.email ?? '-'}{b.email_private ? ' (비공개)' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {registrantNames[b.user_id] ?? '익명'}
                    {' · '}
                    <Link href={`/u/${b.user_id}`} target="_blank" rel="noopener noreferrer" className="text-red-500 dark:text-red-400 hover:underline">프로필</Link>
                    {' · '}{new Date(b.created_at).toLocaleString('ko-KR')}
                    {' · '}
                    <label className="inline-flex items-center gap-1">
                      순서 <input type="number" min={0} value={list.findIndex((x) => x.id === b.id)} onChange={(e) => { const v = Math.max(0, e.target.valueAsNumber || 0); if (v !== list.findIndex((x) => x.id === b.id)) moveOrder(b.id, list[Math.min(v, list.length - 1)]?.id ?? b.id) }} className="w-12 rounded border border-border px-1 py-0.5 text-xs" disabled={!!updating} />
                    </label>
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {b.link_url && (
                      <a href={b.link_url.startsWith('http') ? b.link_url : `https://${b.link_url}`} target="_blank" rel="noopener noreferrer" className="text-xs text-red-500 dark:text-red-400 hover:underline flex items-center gap-0.5">
                        <ExternalLink className="size-3" /> 웹사이트
                      </a>
                    )}
                    {b.instagram_url && (
                      <a href={b.instagram_url.startsWith('http') ? b.instagram_url : `https://${b.instagram_url}`} target="_blank" rel="noopener noreferrer" className="text-xs text-red-500 dark:text-red-400 hover:underline">
                        인스타
                      </a>
                    )}
                  </div>
                </div>
                {!b.approved && (
                  <Button size="sm" onClick={() => handleApprove(b.id)} disabled={!!updating} className="shrink-0">
                    수락
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleToggleHidden(b.id, b.is_hidden)} disabled={!!updating} className="shrink-0">
                    {b.is_hidden ? '숨김 해제' : '숨김'}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(b.id)} disabled={deleting === b.id} className="shrink-0">
                    <Trash2 className="size-3.5" /> 삭제
                  </Button>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
