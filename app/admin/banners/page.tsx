'use client'

import { useEffect, useState, useRef } from 'react'
import { BANNER_SLOTS, getBannerSlotLabel } from '@/lib/bannerSlots'
import {
  getBannerAdCounts,
  getBannerAdsBySlot,
  createBannerAd,
  updateBannerAd,
  deleteBannerAd,
  reorderBannerAds,
  type BannerAdRow,
} from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabaseClient'
import { getBannerAdImageUrl } from '@/lib/storage'
import { fetchSiteSettings } from '@/lib/siteSettings'

const BANNER_SIZE_HINT = '권장 크기 600×100px (가로:세로 비율 6:1). 노출 최대 높이 120px.'

export default function AdminBannersPage() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null)
  const [ads, setAds] = useState<BannerAdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adsLoading, setAdsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState<'add' | { edit: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [rotationBySlot, setRotationBySlot] = useState<Record<string, number>>({})
  const [rotationSaving, setRotationSaving] = useState(false)
  const [feedEveryN, setFeedEveryN] = useState<number>(5)
  const [feedEveryNSaving, setFeedEveryNSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const actionMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showActionMessage = (msg: string) => {
    if (actionMessageTimeoutRef.current) clearTimeout(actionMessageTimeoutRef.current)
    setActionMessage(msg)
    actionMessageTimeoutRef.current = setTimeout(() => {
      setActionMessage(null)
      actionMessageTimeoutRef.current = null
    }, 2500)
  }

  const loadCounts = async () => {
    const res = await getBannerAdCounts()
    if (res.ok) setCounts(res.counts)
    else setError(res.error)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadCounts(),
      fetchSiteSettings().then((s) => {
        setRotationBySlot(s.banner_rotation_by_slot ?? {})
        setFeedEveryN(s.banner_in_feed_every_n_posts)
      }),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedSlotKey) {
      setAds([])
      return
    }
    setAdsLoading(true)
    getBannerAdsBySlot(selectedSlotKey).then((res) => {
      if (res.ok) setAds(res.ads)
      else setSaveError(res.error)
      setAdsLoading(false)
    })
  }, [selectedSlotKey])

  const refetchAds = () => {
    if (selectedSlotKey) {
      getBannerAdsBySlot(selectedSlotKey).then((res) => res.ok && setAds(res.ads))
      loadCounts()
    }
  }

  if (loading) return <p className="text-muted-foreground">로딩 중…</p>
  if (error) return <p className="text-destructive">{error}</p>

  return (
    <div>
      {actionMessage && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-green-600 text-white text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
          role="alert"
        >
          {actionMessage}
        </div>
      )}
      <h1 className="text-2xl font-semibold mb-2">배너 광고</h1>
      <p className="text-muted-foreground text-sm mb-6">
        슬롯별로 여러 광고를 등록하면 로테이션으로 노출됩니다. 슬롯을 선택해 광고를 추가·수정·삭제·순서 변경하세요.
      </p>

      {selectedSlotKey == null ? (
        <div className="grid gap-3">
          {BANNER_SLOTS.map((slot) => (
            <Card key={slot.key}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{slot.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {counts ? `${counts[slot.key] ?? 0}개 광고` : '-'}
                  </p>
                </div>
                <Button onClick={() => setSelectedSlotKey(slot.key)}>관리</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSelectedSlotKey(null); setFormOpen(null) }}>
              ← 슬롯 목록
            </Button>
            <span className="font-medium">{getBannerSlotLabel(selectedSlotKey)}</span>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">로테이션 전환 간격 (이 슬롯)</CardTitle>
              <CardDescription>
                이 슬롯에 여러 광고가 있으면 이 간격(초)마다 다음 광고로 바뀝니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <div className="w-24">
                <Label htmlFor="rotation-seconds">초</Label>
                <Input
                  id="rotation-seconds"
                  type="number"
                  min={1}
                  max={60}
                  value={rotationBySlot[selectedSlotKey] ?? 3}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(60, Number(e.target.value) || 1))
                    setRotationBySlot((prev) => ({ ...prev, [selectedSlotKey]: v }))
                  }}
                />
              </div>
              <Button
                disabled={rotationSaving}
                onClick={async () => {
                  setRotationSaving(true)
                  await supabase.from('site_settings').upsert(
                    { key: `banner_rotation:${selectedSlotKey}`, value_json: rotationBySlot[selectedSlotKey] ?? 3 },
                    { onConflict: 'key' }
                  )
                  setRotationSaving(false)
                  showActionMessage('저장되었습니다.')
                }}
              >
                {rotationSaving ? '저장 중…' : '저장'}
              </Button>
            </CardContent>
          </Card>

          {selectedSlotKey === 'home-in-feed' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">피드 중간 배너 간격 (N개 글마다)</CardTitle>
                <CardDescription>
                  이 슬롯 배너가 홈 피드에서 몇 개 글마다 한 번씩 나올지 설정합니다. 예: 5면 5번째 글 다음, 10번째 글 다음… 에 표시됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-end gap-2">
                <div className="w-24">
                  <Label htmlFor="feed-every-n">N</Label>
                  <Input
                    id="feed-every-n"
                    type="number"
                    min={1}
                    max={50}
                    value={feedEveryN}
                    onChange={(e) => setFeedEveryN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  />
                </div>
                <span className="text-sm text-muted-foreground">개 글마다</span>
                <Button
                  disabled={feedEveryNSaving}
                  onClick={async () => {
                    setFeedEveryNSaving(true)
                    await supabase.from('site_settings').upsert(
                      { key: 'banner_in_feed_every_n_posts', value_json: feedEveryN },
                      { onConflict: 'key' }
                    )
                    setFeedEveryNSaving(false)
                    showActionMessage('저장되었습니다.')
                  }}
                >
                  {feedEveryNSaving ? '저장 중…' : '저장'}
                </Button>
              </CardContent>
            </Card>
          )}

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">광고 목록</CardTitle>
              <CardDescription>순서 변경 후 위/아래 버튼으로 정렬할 수 있어요.</CardDescription>
            </CardHeader>
            <CardContent>
              {adsLoading ? (
                <p className="text-muted-foreground text-sm">로딩 중…</p>
              ) : ads.length === 0 ? (
                <p className="text-muted-foreground text-sm">등록된 광고가 없어요. 아래에서 추가하세요.</p>
              ) : (
                <ul className="space-y-2">
                  {ads.map((ad, idx) => (
                    <li
                      key={ad.id}
                      className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                    >
                      <img
                        src={ad.image_url}
                        alt=""
                        className="w-16 h-10 object-cover rounded bg-muted shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).className = 'w-16 h-10 rounded bg-muted shrink-0' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{ad.link_url}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ad.starts_at).toLocaleDateString('ko-KR')}
                          {ad.ends_at ? ` ~ ${new Date(ad.ends_at).toLocaleDateString('ko-KR')}` : ' ~ 무기한'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFormOpen({ edit: ad.id })}
                        >
                          수정
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!confirm('이 광고를 삭제할까요?')) return
                            const res = await deleteBannerAd(ad.id)
                            if (res.ok) { refetchAds(); showActionMessage('삭제되었습니다.') }
                            else setSaveError(res.error)
                          }}
                        >
                          삭제
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={idx === 0}
                          onClick={async () => {
                            const next = [...ads]
                            const t = next[idx - 1]
                            next[idx - 1] = next[idx]
                            next[idx] = t
                            const res = await reorderBannerAds(selectedSlotKey, next.map((a) => a.id))
                            if (res.ok) { setAds(next); showActionMessage('순서가 변경되었습니다.') }
                            else setSaveError(res.error)
                          }}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={idx === ads.length - 1}
                          onClick={async () => {
                            const next = [...ads]
                            const t = next[idx + 1]
                            next[idx + 1] = next[idx]
                            next[idx] = t
                            const res = await reorderBannerAds(selectedSlotKey, next.map((a) => a.id))
                            if (res.ok) { setAds(next); showActionMessage('순서가 변경되었습니다.') }
                            else setSaveError(res.error)
                          }}
                        >
                          ↓
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {(() => {
            // #region agent log
            const isEdit = typeof formOpen === 'object' && formOpen !== null && 'edit' in formOpen;
            fetch('http://127.0.0.1:7242/ingest/6a8cd37f-df3b-4cd5-8413-44b4064d90cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/banners/page.tsx:formOpen',message:'formOpen check',data:{formOpenType:typeof formOpen,formOpenVal:formOpen===null?null:formOpen==='add'?'add':formOpen,isEdit},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
            // #endregion
            return (formOpen === 'add' || isEdit) && (
            <BannerAdForm
              slotKey={selectedSlotKey}
              editAd={isEdit ? ads.find((a) => a.id === (formOpen as { edit: string }).edit) ?? null : null}
              onClose={() => { setFormOpen(null); setSaveError(null) }}
              onSuccess={() => { showActionMessage('저장되었습니다.'); refetchAds(); setFormOpen(null); setSaveError(null) }}
              setSaving={setSaving}
              setSaveError={setSaveError}
            />
            );
          })()}

          {!formOpen && (
            <Button onClick={() => setFormOpen('add')}>광고 추가</Button>
          )}
        </div>
      )}
    </div>
  )
}

function BannerAdForm({
  slotKey,
  editAd,
  onClose,
  onSuccess,
  setSaving,
  setSaveError,
}: {
  slotKey: string
  editAd: BannerAdRow | null
  onClose: () => void
  onSuccess: () => void
  setSaving: (v: boolean) => void
  setSaveError: (v: string | null) => void
}) {
  const [imageUrl, setImageUrl] = useState(editAd?.image_url ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [linkUrl, setLinkUrl] = useState(editAd?.link_url ?? '')
  const [altText, setAltText] = useState(editAd?.alt_text ?? '')
  const [startsAt, setStartsAt] = useState(
    editAd ? editAd.starts_at.slice(0, 16) : new Date().toISOString().slice(0, 16)
  )
  const [endsAt, setEndsAt] = useState(editAd?.ends_at ? editAd.ends_at.slice(0, 16) : '')
  const [sortOrder, setSortOrder] = useState(editAd?.sort_order ?? 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imageUrl.trim() && !imageFile) {
      setSaveError('이미지 URL을 입력하거나 파일을 선택해 주세요.')
      return
    }
    setSaving(true)
    setSaveError(null)
    let finalImageUrl = imageUrl.trim()
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('banner-ads').upload(path, imageFile, {
        contentType: imageFile.type,
        upsert: false,
      })
      if (uploadErr) {
        setSaving(false)
        setSaveError(uploadErr.message || '이미지 업로드 실패')
        return
      }
      finalImageUrl = getBannerAdImageUrl(path)
    }
    if (editAd) {
      const res = await updateBannerAd(editAd.id, {
        image_url: finalImageUrl,
        link_url: linkUrl.trim(),
        alt_text: altText.trim() || null,
        sort_order: sortOrder,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      })
      setSaving(false)
      if (res.ok) onSuccess()
      else setSaveError(res.error ?? '저장 실패')
    } else {
      const res = await createBannerAd({
        slot_key: slotKey,
        image_url: finalImageUrl,
        link_url: linkUrl.trim(),
        alt_text: altText.trim() || undefined,
        sort_order: sortOrder,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      })
      setSaving(false)
      if (res.ok) onSuccess()
      else setSaveError(res.error ?? '저장 실패')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{editAd ? '광고 수정' : '광고 추가'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-muted-foreground">{BANNER_SIZE_HINT}</p>
          <div>
            <Label htmlFor="banner-image">이미지 URL (또는 아래에서 파일 업로드)</Label>
            <Input
              id="banner-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              disabled={!!imageFile}
            />
          </div>
          <div>
            <Label htmlFor="banner-upload">이미지 파일 업로드</Label>
            <Input
              id="banner-upload"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setImageFile(f ?? null)
                if (f) setImageUrl('')
              }}
            />
            {imageFile && (
              <p className="text-xs text-muted-foreground mt-1">
                선택됨: {imageFile.name}
                <button
                  type="button"
                  onClick={() => { setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="ml-2 text-foreground hover:underline"
                >
                  취소
                </button>
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="banner-link">링크 URL</Label>
            <Input
              id="banner-link"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </div>
          <div>
            <Label htmlFor="banner-alt">대체 텍스트 (선택)</Label>
            <Input
              id="banner-alt"
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="광고 설명"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="banner-starts">노출 시작</Label>
              <Input
                id="banner-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="banner-ends">노출 종료 (비우면 무기한)</Label>
              <Input
                id="banner-ends"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="banner-order">정렬 순서 (숫자 작을수록 앞)</Label>
            <Input
              id="banner-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">저장</Button>
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
