'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import ReportDialog from './ReportDialog'

export default function AuthorMenu({
  targetUserId,
  targetAnonName,
  currentUserId,
  children,
}: {
  targetUserId: string
  targetAnonName: string
  currentUserId: string | null | undefined
  children: React.ReactNode
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)

  const canAct = currentUserId && currentUserId !== targetUserId
  if (!canAct) {
    return <>{children}</>
  }

  const handleBlock = async () => {
    if (!currentUserId || blocking) return
    setBlocking(true)
    await supabase.from('blocked_users').insert({ blocker_id: currentUserId, blocked_id: targetUserId })
    setBlocking(false)
    setMenuOpen(false)
    router.refresh()
    router.push('/')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        className="text-left shrink-0"
      >
        {children}
      </button>
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="작성자 메뉴"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="relative bg-background border-t border-border rounded-t-2xl px-4 pt-4 pb-safe">
            <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-3">{targetAnonName}님</p>
            <div className="flex flex-col gap-1 pb-6">
              <Button
                variant="outline"
                className="justify-center rounded-xl py-6"
                onClick={handleBlock}
                disabled={blocking}
              >
                {blocking ? '처리 중…' : '차단하기'}
              </Button>
              <Button
                variant="outline"
                className="justify-center rounded-xl py-6"
                onClick={() => { setMenuOpen(false); setReportOpen(true) }}
              >
                신고하기
              </Button>
              <Button
                variant="ghost"
                className="justify-center rounded-xl py-4 text-muted-foreground"
                onClick={() => setMenuOpen(false)}
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetUserId={targetUserId}
        targetAnonName={targetAnonName}
        onSuccess={() => { setReportOpen(false); router.refresh() }}
      />
    </>
  )
}
