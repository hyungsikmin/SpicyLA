'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import WriteForm from '@/components/WriteForm'

export default function WritePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <main className="max-w-xl mx-auto p-4 sm:p-6">
        <p className="text-muted-foreground">확인 중...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="max-w-xl mx-auto p-4 sm:p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>글쓰기</CardTitle>
            <CardDescription>글을 쓰려면 로그인해 주세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">로그인</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>글쓰기</CardTitle>
          <CardDescription>제목과 카테고리는 필수예요. 이미지는 최대 3장, 각 5MB 이하.</CardDescription>
        </CardHeader>
        <CardContent>
          <WriteForm
            user={user}
            onSuccess={() => router.push('/')}
            onCancel={() => router.push('/')}
          />
        </CardContent>
      </Card>
    </main>
  )
}
