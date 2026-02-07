'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const REPORT_REASONS = [
  { value: 'spam', label: '스팸·광고' },
  { value: 'abuse', label: '욕설·혐오 표현' },
  { value: 'privacy', label: '개인정보 유출·도용' },
  { value: 'sexual', label: '음란·선정적 콘텐츠' },
  { value: 'scam', label: '사기·사칭' },
  { value: 'harassment', label: '따돌림·괴롭힘' },
  { value: 'copyright', label: '저작권 침해' },
  { value: 'other', label: '기타' },
]

export default function ReportDialog({
  open,
  onClose,
  targetUserId,
  targetAnonName,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  targetUserId: string
  targetAnonName: string
  onSuccess: () => void
}) {
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('신고 사유를 선택해 주세요.')
      return
    }
    setError(null)
    setSubmitting(true)
    const reasonLabel = REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason
    const fullReason = detail.trim() ? `${reasonLabel}\n${detail.trim()}` : reasonLabel
    const { data: { user } } = await supabase.auth.getUser()
    const { error: insertErr } = await supabase.from('reports').insert({
      target_type: 'user',
      target_id: targetUserId,
      reason: fullReason,
      reporter_id: user?.id ?? null,
    })
    if (insertErr) {
      setError(insertErr.message)
      setSubmitting(false)
      return
    }
    try {
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          targetAnonName,
          reason: reasonLabel,
          detail: detail.trim() || undefined,
        }),
      })
    } catch {
      // Report already saved; email is best-effort
    }
    setSubmitting(false)
    setReason('')
    setDetail('')
    onSuccess()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="신고하기"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border-t border-border rounded-t-2xl px-4 pt-4 pb-safe max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-1">신고하기</h2>
        <p className="text-sm text-muted-foreground mb-4">{targetAnonName}님을 신고합니다.</p>
        <div className="space-y-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="report-reason">신고 사유 *</Label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">선택하세요</option>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-detail">추가 설명 (선택)</Label>
            <Textarea
              id="report-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="구체적인 내용을 적어주시면 검토에 도움이 됩니다."
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            <Button className="flex-1 rounded-xl" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '접수 중…' : '신고하기'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
