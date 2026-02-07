'use client'

import type { User } from '@supabase/supabase-js'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function generateAnonName() {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `익명${num}`
}

export default function LoginPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/'
  const [loading, setLoading] = useState(false)
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

  const loginWithGoogle = async () => {
    try {
      setLoading(true)
      const returnUrl = from && from !== '/' ? `${window.location.origin}/login?from=${encodeURIComponent(from)}` : window.location.origin
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: returnUrl },
      })
      if (error) {
        alert(error.message)
        setLoading(false)
        return
      }
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
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
          <CardTitle className="text-xl">아니스비 로그인</CardTitle>
          <CardDescription>
            로그인하면 글쓰기와 댓글을 사용할 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <p className="text-center text-sm text-muted-foreground">
              로그인 처리 중…
            </p>
          ) : (
            <Button
              variant="spicy"
              className="w-full"
              onClick={loginWithGoogle}
              disabled={loading}
            >
              {loading ? '로그인 중…' : 'Google로 로그인'}
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
