'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

function generateAnonName() {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `익명${num}`
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (access_token && refresh_token) {
          const { data: { session: newSession }, error: setErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (!mounted) return
          if (setErr) {
            setStatus('error')
            return
          }
          if (!newSession) {
            setStatus('error')
            return
          }
          await new Promise<void>((resolve) => {
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
              if (event === 'SIGNED_IN' && session?.user?.email === newSession.user.email) {
                subscription.unsubscribe()
                resolve()
              }
            })
            setTimeout(() => {
              subscription.unsubscribe()
              resolve()
            }, 1000)
          })
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname)
          }
        } else {
          const { data: { session }, error } = await supabase.auth.getSession()
          if (!mounted) return
          if (error || !session) {
            setStatus('error')
            return
          }
        }

        const { data: { session: finalSession } } = await supabase.auth.getSession()
        if (!mounted) return
        if (!finalSession) {
          setStatus('error')
          return
        }

        const uid = finalSession.user.id
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, terms_accepted_at, onboarding_completed_at')
          .eq('user_id', uid)
          .maybeSingle()
        if (!mounted) return
        if (!profile) {
          await supabase.from('profiles').insert({
            user_id: uid,
            anon_name: generateAnonName(),
          })
          setStatus('done')
          window.location.href = '/welcome?from=/'
          return
        }
        const p = profile as { terms_accepted_at?: string | null; onboarding_completed_at?: string | null }
        const termsAccepted = p.terms_accepted_at ?? null
        const onboardingCompleted = p.onboarding_completed_at ?? null
        if (termsAccepted == null) {
          setStatus('done')
          window.location.href = '/welcome?from=/'
          return
        }
        if (onboardingCompleted == null) {
          setStatus('done')
          window.location.href = '/welcome?step=onboarding&from=/'
          return
        }
        setStatus('done')
        window.location.href = '/'
      } catch {
        if (mounted) setStatus('error')
      }
    })()
    return () => { mounted = false }
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      {status === 'loading' && <p className="text-muted-foreground text-sm">로그인 처리 중…</p>}
      {status === 'done' && <p className="text-muted-foreground text-sm">이동 중…</p>}
      {status === 'error' && (
        <div className="text-center">
          <p className="text-destructive text-sm mb-2">로그인 처리에 실패했어요.</p>
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            홈으로
          </button>
        </div>
      )}
    </main>
  )
}
