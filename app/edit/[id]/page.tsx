'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: post } = await supabase
        .from('posts')
        .select('title, body, user_id')
        .eq('id', id)
        .single()
      if (!post || post.user_id !== user.id) {
        router.push('/')
        return
      }
      setTitle(post.title || '')
      setBody(post.body)
      setLoading(false)
    }
    load()
  }, [id, router])

  const submit = async () => {
    await supabase.from('posts').update({ title, body }).eq('id', id)
    router.push(`/p/${id}`)
  }

  if (loading) {
    return (
      <main className="max-w-xl mx-auto p-4 sm:p-6">
        <p className="text-muted-foreground">로딩 중…</p>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>글 수정</CardTitle>
          <CardDescription>제목과 내용을 수정할 수 있어요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (선택)"
            className="bg-background"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="resize-y bg-background"
          />
          <div className="flex gap-2">
            <Button variant="spicy" onClick={submit}>
              수정 완료
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/p/${id}`}>취소</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
