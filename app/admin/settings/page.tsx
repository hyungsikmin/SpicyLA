'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  fetchSiteSettings,
  fetchTiers,
  type SiteSettings,
  type Tier,
} from '@/lib/siteSettings'
import { Button } from '@/components/ui/button'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<'settings' | 'tier' | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const showSaved = () => {
    setSavedMessage('저장되었습니다.')
    setTimeout(() => setSavedMessage(null), 2000)
  }

  const load = async () => {
    setLoading(true)
    const [s, t] = await Promise.all([fetchSiteSettings(), fetchTiers()])
    setSettings(s)
    setTiers(t)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleSaveSettings = async () => {
    if (!settings) return
    setSaving('settings')
    await Promise.all([
      supabase.from('site_settings').upsert(
        { key: 'best_comment_min_likes', value_json: settings.best_comment_min_likes },
        { onConflict: 'key' }
      ),
      supabase.from('site_settings').upsert(
        { key: 'trending_min_count', value_json: settings.trending_min_count },
        { onConflict: 'key' }
      ),
      supabase.from('site_settings').upsert(
        { key: 'trending_max', value_json: settings.trending_max },
        { onConflict: 'key' }
      ),
      supabase.from('site_settings').upsert(
        { key: 'popular_members_count', value_json: settings.popular_members_count },
        { onConflict: 'key' }
      ),
      supabase.from('site_settings').upsert(
        { key: 'popular_members_min_score', value_json: settings.popular_members_min_score },
        { onConflict: 'key' }
      ),
    ])
    setSaving(null)
    showSaved()
  }

  const handleSaveTier = async (tier: Tier) => {
    setSaving('tier')
    const isNew = tier.id.startsWith('new-')
    const payload = {
      name: tier.name,
      min_posts: tier.min_posts,
      min_comments: tier.min_comments,
      min_reactions: tier.min_reactions,
      sort_order: tier.sort_order,
      badge_color: tier.badge_color ?? null,
    }
    if (!isNew) {
      await supabase.from('tiers').update(payload).eq('id', tier.id)
    } else {
      await supabase.from('tiers').insert({ ...payload, name: tier.name || '새 등급' })
      await load()
    }
    setSaving(null)
    showSaved()
  }

  const handleDeleteTier = async (id: string) => {
    if (id.startsWith('new-')) {
      setTiers((prev) => prev.filter((t) => t.id !== id))
      return
    }
    if (!confirm('이 등급을 삭제할까요?')) return
    setSaving('tier')
    await supabase.from('tiers').delete().eq('id', id)
    setTiers((prev) => prev.filter((t) => t.id !== id))
    setSaving(null)
    showSaved()
  }

  const addTier = () => {
    const maxOrder = tiers.length ? Math.max(...tiers.map((t) => t.sort_order)) : 0
    const tempId = `new-${Date.now()}`
    setTiers((prev) => [
      ...prev,
      {
        id: tempId,
        name: '',
        min_posts: 0,
        min_comments: 0,
        min_reactions: 0,
        sort_order: maxOrder + 1,
        badge_color: null,
      },
    ])
  }

  if (loading || !settings) {
    return <p className="text-muted-foreground">불러오는 중…</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">사이트 설정</h1>
      {savedMessage && (
        <p className="mb-4 px-4 py-2 rounded-lg bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30 animate-in fade-in" role="status">
          {savedMessage}
        </p>
      )}

      <section id="best-trending" className="mb-10 scroll-mt-4">
        <h2 className="text-lg font-semibold mb-3">베스트 댓글</h2>
        <p className="text-sm text-muted-foreground mb-4">
          배댓으로 표시되려면 댓글 좋아요 수가 최소 값 이상이어야 합니다.
        </p>
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">배댓 최소 좋아요</label>
            <input
              type="number"
              min={0}
              value={settings.best_comment_min_likes}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, best_comment_min_likes: Math.max(0, parseInt(e.target.value, 10) || 0) } : s
                )
              }
              className="rounded border border-border bg-background px-3 py-2 w-24"
            />
          </div>
          <Button onClick={handleSaveSettings} disabled={saving === 'settings'}>
            {saving === 'settings' ? '저장 중…' : '저장'}
          </Button>
        </div>

        <h2 className="text-lg font-semibold mb-3">트렌딩</h2>
        <p className="text-sm text-muted-foreground mb-4">
          트렌딩 섹션에는 리액션 수가 최소 값 이상인 글이 최대 N개까지 노출됩니다.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">트렌딩 최소 리액션 수</label>
            <input
              type="number"
              min={0}
              value={settings.trending_min_count}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, trending_min_count: Math.max(0, parseInt(e.target.value, 10) || 0) } : s
                )
              }
              className="rounded border border-border bg-background px-3 py-2 w-24"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">트렌딩 최대 개수</label>
            <input
              type="number"
              min={1}
              value={settings.trending_max}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, trending_max: Math.max(1, parseInt(e.target.value, 10) || 1) } : s
                )
              }
              className="rounded border border-border bg-background px-3 py-2 w-24"
            />
          </div>
          <Button onClick={handleSaveSettings} disabled={saving === 'settings'}>
            {saving === 'settings' ? '저장 중…' : '저장'}
          </Button>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">인기 멤버</h2>
        <p className="text-sm text-muted-foreground mb-4">
          최근 글 기준 점수(글+리액션+댓글) 상위 N명, 최소 점수 이상만 표시됩니다.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">표시 인원 수</label>
            <input
              type="number"
              min={1}
              max={20}
              value={settings.popular_members_count}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, popular_members_count: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) } : s
                )
              }
              className="rounded border border-border bg-background px-3 py-2 w-24"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">최소 점수</label>
            <input
              type="number"
              min={0}
              value={settings.popular_members_min_score}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, popular_members_min_score: Math.max(0, parseInt(e.target.value, 10) || 0) } : s
                )
              }
              className="rounded border border-border bg-background px-3 py-2 w-24"
            />
          </div>
          <Button onClick={handleSaveSettings} disabled={saving === 'settings'}>
            {saving === 'settings' ? '저장 중…' : '저장'}
          </Button>
        </div>
      </section>

      <section id="tiers" className="scroll-mt-4">
        <h2 className="text-lg font-semibold mb-3">등급</h2>
        <p className="text-sm text-muted-foreground mb-4">
          글 수, 댓글 수, 리액션 수가 모두 조건을 만족하면 해당 등급이 부여됩니다. sort_order가 클수록 상위 등급입니다.
        </p>
        <div className="space-y-3">
          {tiers.map((tier) => (
            <TierRow
              key={tier.id}
              tier={tier}
              onUpdate={(next) =>
                setTiers((prev) => prev.map((t) => (t.id === tier.id ? next : t)))
              }
              onSave={() => handleSaveTier(tier)}
              onDelete={() => handleDeleteTier(tier.id)}
              saving={saving === 'tier'}
            />
          ))}
        </div>
        <Button variant="outline" className="mt-3" onClick={addTier} disabled={saving === 'tier'}>
          등급 추가
        </Button>
      </section>
    </div>
  )
}

const DEFAULT_BADGE_HEX = '#dc2626'

function hexOrNull(s: string | null | undefined): string | null {
  if (s == null || s === '') return null
  const h = s.startsWith('#') ? s : `#${s}`
  return /^#[0-9A-Fa-f]{6}$/.test(h) ? h : null
}

function TierRow({
  tier,
  onUpdate,
  onSave,
  onDelete,
  saving,
}: {
  tier: Tier
  onUpdate: (t: Tier) => void
  onSave: () => void
  onDelete?: () => void
  saving: boolean
}) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const displayHex = tier.badge_color ?? DEFAULT_BADGE_HEX
  const normalizedHex = /^#[0-9A-Fa-f]{6}$/.test(displayHex) ? displayHex : DEFAULT_BADGE_HEX
  const hexDisplay = tier.badge_color ? (normalizedHex !== DEFAULT_BADGE_HEX ? normalizedHex : tier.badge_color) : null
  return (
    <div className="flex flex-wrap gap-2 items-center rounded-lg border border-border p-3 bg-card">
      <input
        type="text"
        placeholder="등급 이름"
        value={tier.name}
        onChange={(e) => onUpdate({ ...tier, name: e.target.value })}
        className="rounded border border-border bg-background px-2 py-1.5 w-24 text-sm"
      />
      <span className="text-muted-foreground text-sm">색 (hex)</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          className="shrink-0 size-8 rounded border-2 border-border cursor-pointer overflow-hidden p-0 hover:ring-2 hover:ring-ring transition-shadow"
          title="클릭하면 색 팔레트 열기"
        >
          <span
            className="block size-full"
            style={{
              backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(displayHex) ? displayHex : 'var(--muted)',
            }}
          />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={normalizedHex}
          onChange={(e) => onUpdate({ ...tier, badge_color: e.target.value })}
          className="sr-only"
          aria-hidden
        />
        <input
          type="text"
          placeholder="#dc2626"
          value={tier.badge_color ?? ''}
          onChange={(e) => {
            const v = e.target.value.trim()
            const hex = hexOrNull(v)
            onUpdate({ ...tier, badge_color: hex ?? (v === '' ? null : v) })
          }}
          className="rounded border border-border bg-background px-2 py-1.5 w-24 text-sm font-mono text-xs"
          maxLength={7}
        />
        {hexDisplay != null && (
          <span className="text-xs text-muted-foreground font-mono" title="현재 hex">
            {hexDisplay}
          </span>
        )}
        <button
          type="button"
          onClick={() => onUpdate({ ...tier, badge_color: null })}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          기본색
        </button>
      </div>
      <span className="text-muted-foreground text-sm">글</span>
      <input
        type="number"
        min={0}
        value={tier.min_posts}
        onChange={(e) => onUpdate({ ...tier, min_posts: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        className="rounded border border-border bg-background px-2 py-1.5 w-16 text-sm"
      />
      <span className="text-muted-foreground text-sm">댓글</span>
      <input
        type="number"
        min={0}
        value={tier.min_comments}
        onChange={(e) => onUpdate({ ...tier, min_comments: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        className="rounded border border-border bg-background px-2 py-1.5 w-16 text-sm"
      />
      <span className="text-muted-foreground text-sm">리액션</span>
      <input
        type="number"
        min={0}
        value={tier.min_reactions}
        onChange={(e) => onUpdate({ ...tier, min_reactions: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        className="rounded border border-border bg-background px-2 py-1.5 w-16 text-sm"
      />
      <span className="text-muted-foreground text-sm">순서</span>
      <input
        type="number"
        min={0}
        value={tier.sort_order}
        onChange={(e) => onUpdate({ ...tier, sort_order: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        className="rounded border border-border bg-background px-2 py-1.5 w-14 text-sm"
      />
      <Button size="sm" onClick={onSave} disabled={saving}>
        저장
      </Button>
      {onDelete && (
        <Button size="sm" variant="outline" onClick={onDelete} disabled={saving}>
          삭제
        </Button>
      )}
    </div>
  )
}
