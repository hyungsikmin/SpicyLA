'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function ProfileEditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'name'
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [anonName, setAnonName] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialNameRef = useRef<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login?from=/profile/edit')
        return
      }
      setUser(data.user)
      supabase.from('profiles').select('anon_name, status').eq('user_id', data.user.id).single().then(({ data: p }) => {
        if (p) {
          const name = (p as { anon_name: string | null }).anon_name ?? ''
          setAnonName(name)
          initialNameRef.current = name.trim()
          setStatus((p as { status: string | null }).status ?? '')
        }
      })
    })
  }, [router])

  useEffect(() => {
    if (!user) return
    const trimmed = anonName.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!trimmed) {
      setDuplicateError(false)
      return
    }
    if (trimmed === initialNameRef.current) {
      setDuplicateError(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null
      const nameToCheck = trimmed.slice(0, 8)
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('anon_name', nameToCheck)
        .neq('user_id', user.id)
        .maybeSingle()
      setDuplicateError(!!existing)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [anonName, user])

  const save = async () => {
    if (!user) return
    setError(null)
    if (duplicateError) return
    setSaving(true)
    const trimmedName = anonName.trim()
    if (tab === 'name' || tab !== 'status') {
      if (!trimmedName) {
        setError('닉네임을 입력해 주세요.')
        setSaving(false)
        return
      }
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('anon_name', trimmedName.slice(0, 8))
        .neq('user_id', user.id)
        .maybeSingle()
      if (existing) {
        setError('이미 사용 중인 아이디예요.')
        setSaving(false)
        return
      }
    }
    const updates: { anon_name?: string; status?: string } = {}
    if (tab === 'name' || tab !== 'status') updates.anon_name = trimmedName.slice(0, 8) || undefined
    if (tab === 'status' || tab !== 'name') updates.status = status.trim() || undefined
    const { error: e } = await supabase.from('profiles').update(updates).eq('user_id', user.id)
    setSaving(false)
    if (e) {
      setError(e.message)
      return
    }
    router.push('/profile')
  }

  if (!user) {
    return (
      <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background flex items-center justify-center p-8">
        <p className="text-muted-foreground">로딩 중…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background p-4">
      <header className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/profile">←</Link>
        </Button>
        <h1 className="text-lg font-semibold">회원정보 수정</h1>
      </header>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="anon_name">닉네임 (익명 아이디)</Label>
          <Input
            id="anon_name"
            value={anonName}
            onChange={(e) => setAnonName(e.target.value)}
            placeholder="익명1234"
            maxLength={8}
            className="rounded-xl"
          />
          <p className={`text-xs ${duplicateError ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {duplicateError ? '이미 사용 중인 아이디예요.' : '다른 사람에게 보이는 이름이에요. 최대 8글자. 예: 익명1002'}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">상태메시지</Label>
          <Textarea
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="LA 사는 직장인"
            maxLength={50}
            rows={2}
            className="rounded-xl resize-none"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full rounded-xl" onClick={save} disabled={saving || duplicateError}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </div>
    </main>
  )
}
