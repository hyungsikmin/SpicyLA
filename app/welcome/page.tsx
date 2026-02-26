'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { BlurCarouselModal, type BlurCarouselSlide } from '@/components/BlurCarouselModal'
import { TERMS_TITLE, TERMS_FULL } from '@/lib/terms'
import { Users, FileCheck } from 'lucide-react'

const ONBOARDING_SLIDES: BlurCarouselSlide[] = [
  {
    logoInOrb: true,
    title: '아니스비에 온걸 환영해❣️',
    description: '여긴 20·30👫 익명 커뮤니티니 안심하고 솔직하게 부담없이 마음껏 얘기를 나눠봐!',
  },
  {
    icon: <Users className="size-10" />,
    title: '함께 만들어가는 커뮤니티',
    description: '정치, 종교 및 욕설은 경고 없이 즉시 삭제 및 강퇴 처리돼. 모두가 편하게 솔직하게 얘기할 수 있는 공간이지만 혐오스럽거나 불쾌함을 줄 수 있는건 절대 금지야!',
  },
  {
    icon: <FileCheck className="size-10" />,
    title: '커뮤니티 이용 약관을 준수하겠습니다',
    description: '이용약관과 커뮤니티 규칙을 확인하셨다면 아래 버튼을 눌러 시작하세요.',
  },
]

function WelcomePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const from = searchParams.get('from') || '/'
  const stepParam = searchParams.get('step')
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'terms' | 'onboarding'>(stepParam === 'onboarding' ? 'onboarding' : 'terms')
  const [declined, setDeclined] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(stepParam === 'onboarding')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id } : null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (loading || !user) return
    if (stepParam === 'onboarding') {
      setStep('onboarding')
      setOnboardingOpen(true)
    }
  }, [loading, user, stepParam])

  const handleAcceptTerms = async () => {
    if (!user) return
    setSubmitting(true)
    const { error } = await supabase
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('user_id', user.id)
    setSubmitting(false)
    if (error) return
    setDeclined(false)
    setStep('onboarding')
    setOnboardingOpen(true)
  }

  const handleDeclineTerms = () => {
    setDeclined(true)
  }

  const completeOnboarding = async () => {
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) return
    setOnboardingOpen(false)
    router.replace(from.startsWith('/') ? from : '/')
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">로딩 중…</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-foreground mb-4">로그인이 필요해요.</p>
          <Button asChild>
            <Link href={`/login?from=${encodeURIComponent('/welcome' + (from !== '/' ? '?from=' + encodeURIComponent(from) : ''))}`}>
              로그인
            </Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background flex flex-col overflow-hidden">
      {step === 'terms' && (
        <div className="flex flex-col h-[100dvh] max-h-[100dvh] max-w-[600px] mx-auto w-full px-4">
          <h1 className="text-xl font-bold text-foreground mb-2 pt-4 pb-2 shrink-0">
            {TERMS_TITLE}
          </h1>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-line text-sm leading-relaxed pb-4">
              {TERMS_FULL}
            </div>
          </div>
          <div className="shrink-0 pt-4 pb-6 space-y-3 border-t border-border/50 mt-2">
            {declined && (
              <p className="text-destructive font-medium text-sm">
                동의해야만 이용 가능합니다. 서비스를 이용하려면 아래에서 동의해 주세요.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleAcceptTerms}
                disabled={submitting}
                className="flex-1 min-w-[140px]"
              >
                {submitting ? '처리 중…' : '동의하고 계속'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDeclineTerms}
                className="flex-1 min-w-[140px]"
              >
                동의하지 않음
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'onboarding' && (
        <BlurCarouselModal
          open={onboardingOpen}
          onOpenChange={setOnboardingOpen}
          slides={ONBOARDING_SLIDES}
          onFinish={completeOnboarding}
          finishLabel="커뮤니티 이용 약관을 준수하겠습니다"
        />
      )}
    </main>
  )
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-4">
          <p className="text-muted-foreground text-sm">로딩 중…</p>
        </main>
      }
    >
      <WelcomePageContent />
    </Suspense>
  )
}
