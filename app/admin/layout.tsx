'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { LayoutDashboard, Flag, FileText, MessageSquare, Users, Sparkles, ScrollText, Settings } from 'lucide-react'

const NAV = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/reports', label: '신고', icon: Flag },
  { href: '/admin/posts', label: '게시글', icon: FileText },
  { href: '/admin/comments', label: '댓글', icon: MessageSquare },
  { href: '/admin/users', label: '유저', icon: Users },
  { href: '/admin/business', label: '비즈니스', icon: Sparkles },
  { href: '/admin/settings', label: '설정', icon: Settings },
  { href: '/admin/logs', label: '활동 로그', icon: ScrollText },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [admin, setAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id
      if (!uid) {
        router.replace('/login?from=/admin')
        return
      }
      supabase.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle().then(({ data: adminRow }) => {
        if (adminRow) {
          setAdmin(true)
        } else {
          setAdmin(false)
          router.replace('/')
        }
      })
    })
  }, [router])

  if (admin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">확인 중…</p>
      </div>
    )
  }
  if (!admin) return null

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-56 border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <Link href="/admin" className="font-semibold text-lg">관리자</Link>
          <p className="text-xs text-muted-foreground mt-0.5">아니스비</p>
        </div>
        <nav className="p-2 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname === href || (href !== '/admin' && pathname.startsWith(href))
                  ? 'bg-muted font-medium'
                  : 'hover:bg-muted/60'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-2 border-t border-border">
          <Link href="/" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60">
            사이트로 돌아가기
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
