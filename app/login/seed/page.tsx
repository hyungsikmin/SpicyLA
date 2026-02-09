'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function generateAnonName() {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `익명${num}`
}

export default function SeedLoginPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [])

  const ensureProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile) {
      await supabase.from('profiles').insert({
        user_id: user.id,
        anon_name: generateAnonName(),
      })
    }
  }

  const loginWithEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    const { data } = await supabase.auth.getUser()
    setUser(data.user)
  }

  useEffect(() => {
    if (!user) return
    ensureProfile().then(async () => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      let isAdmin = false
      if (uid) {
        const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle()
        isAdmin = !!adminRow
      }
      const redirectTo = isAdmin ? '/admin' : (from.startsWith('/') ? from : '/')
      window.location.href = redirectTo
    })
  }, [user, from])

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">시드 계정 로그인</CardTitle>
          <CardDescription>
            관리자에서 만든 시드 계정으로 로그인할 수 있어요. 이메일과 비밀번호를 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <p className="text-center text-sm text-muted-foreground">
              로그인 처리 중…
            </p>
          ) : (
            <form onSubmit={loginWithEmailPassword} className="space-y-3">
              <div>
                <Label htmlFor="seed-email">이메일</Label>
                <Input
                  id="seed-email"
                  type="email"
                  placeholder="a1@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="seed-password">비밀번호</Label>
                <Input
                  id="seed-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                disabled={loading}
              >
                {loading ? '로그인 중…' : '로그인'}
              </Button>
            </form>
          )}
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="hover:underline">← 일반 로그인 (Google)</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
