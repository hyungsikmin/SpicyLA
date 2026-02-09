'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { createSeedAccount, createSeedAccountsBulk, getSeedAccountsList, type SeedAccountRow } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SeedAccountsClient({
  seedPassword,
  initialList,
}: {
  seedPassword: string | null
  initialList: SeedAccountRow[]
}) {
  const [list, setList] = useState<SeedAccountRow[]>(initialList)
  const [email, setEmail] = useState('')
  const [anonName, setAnonName] = useState('')
  const [singleLoading, setSingleLoading] = useState(false)
  const [singleError, setSingleError] = useState<string | null>(null)

  const [prefix, setPrefix] = useState('a')
  const [start, setStart] = useState(1000)
  const [end, setEnd] = useState(1100)
  const [domain, setDomain] = useState('@gmail.com')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  const [loginLoading, setLoginLoading] = useState<string | null>(null)

  const refetchList = async () => {
    const res = await getSeedAccountsList()
    if (res.ok) setList(res.list)
  }

  const handleCreateOne = async (e: React.FormEvent) => {
    e.preventDefault()
    setSingleError(null)
    setSingleLoading(true)
    const res = await createSeedAccount({ email: email.trim(), anon_name: anonName.trim() || undefined })
    setSingleLoading(false)
    if (res.ok) {
      setEmail('')
      setAnonName('')
      refetchList()
    } else {
      setSingleError(res.error ?? '실패')
    }
  }

  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBulkResult(null)
    setBulkLoading(true)
    const res = await createSeedAccountsBulk({ prefix, start, end, domain })
    setBulkLoading(false)
    if (res.ok) {
      setBulkResult(`생성 ${res.created}개, 스킵 ${res.skipped}개`)
      refetchList()
    } else {
      setBulkResult(res.error ?? '실패')
    }
  }

  const handleLoginAs = async (row: SeedAccountRow) => {
    if (!seedPassword) {
      alert('SEED_ACCOUNT_PASSWORD 환경 변수가 설정되지 않았어요.')
      return
    }
    setLoginLoading(row.email)
    const { error } = await supabase.auth.signInWithPassword({ email: row.email, password: seedPassword })
    setLoginLoading(null)
    if (error) {
      alert(error.message)
      return
    }
    window.location.href = '/'
  }

  const noPassword = seedPassword == null || seedPassword === ''

  return (
    <div className="space-y-6">
      {noPassword && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <strong>SEED_ACCOUNT_PASSWORD</strong> 환경 변수를 설정해야 「이 계정으로 로그인」이 동작해요.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>계정 1개 생성</CardTitle>
          <CardDescription>이메일만 넣으면 인증 없이 바로 생성돼요. 익명 이름은 선택.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOne} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="seed-email">이메일</Label>
              <Input
                id="seed-email"
                type="text"
                placeholder="a1@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="seed-anon">익명 이름 (선택)</Label>
              <Input
                id="seed-anon"
                type="text"
                placeholder="익명1234"
                value={anonName}
                onChange={(e) => setAnonName(e.target.value)}
                className="w-32"
              />
            </div>
            <Button type="submit" disabled={singleLoading}>
              {singleLoading ? '생성 중…' : '계정 생성'}
            </Button>
            {singleError && <p className="text-sm text-destructive">{singleError}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>벌크 생성</CardTitle>
          <CardDescription>
            접두어 + 번호 범위 + 도메인으로 한 번에 생성. 예: a1000 ~ a1100 @gmail.com (비번 동일)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBulkCreate} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>접두어</Label>
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-20" />
            </div>
            <div className="space-y-1">
              <Label>시작</Label>
              <Input
                type="number"
                value={start}
                onChange={(e) => setStart(Number(e.target.value) || 0)}
                className="w-20"
              />
            </div>
            <div className="space-y-1">
              <Label>끝</Label>
              <Input
                type="number"
                value={end}
                onChange={(e) => setEnd(Number(e.target.value) || 0)}
                className="w-20"
              />
            </div>
            <div className="space-y-1">
              <Label>도메인</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} className="w-32" placeholder="@gmail.com" />
            </div>
            <Button type="submit" disabled={bulkLoading}>
              {bulkLoading ? '생성 중…' : `${prefix}${start}~${prefix}${end} ${domain} 생성`}
            </Button>
            {bulkResult && <p className="text-sm text-muted-foreground">{bulkResult}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>시드 계정 목록</CardTitle>
          <CardDescription>
            아래에서 「이 계정으로 로그인」으로 전환하거나,{' '}
            <Link href="/login/seed" className="text-foreground font-medium hover:underline">이메일 + 비밀번호로 로그인</Link>
            에서 직접 입력해 들어갈 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {list.length === 0 && <li className="text-sm text-muted-foreground">아직 생성된 시드 계정이 없어요.</li>}
            {list.map((row) => (
              <li key={row.user_id} className="flex items-center justify-between gap-2 py-1 border-b border-border/50">
                <span className="text-sm font-mono truncate">{row.email}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLoginAs(row)}
                  disabled={noPassword || loginLoading === row.email}
                >
                  {loginLoading === row.email ? '로그인 중…' : '이 계정으로 로그인'}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
