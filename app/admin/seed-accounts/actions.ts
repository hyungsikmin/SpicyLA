'use server'

import { createSupabaseServer } from '@/lib/supabaseServer'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { generateAnonName } from '@/lib/anon'

const SEED_PASSWORD = process.env.SEED_ACCOUNT_PASSWORD ?? 'seed-change-me'

async function ensureAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }
  const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) return { ok: false, error: '관리자만 사용할 수 있어요.' }
  return { ok: true, userId: user.id }
}

export async function createSeedAccount(formData: { email: string; anon_name?: string }) {
  const admin = await ensureAdmin()
  if (!admin.ok) return admin

  const email = String(formData.email ?? '').trim().toLowerCase()
  if (!email) return { ok: false as const, error: '이메일을 입력해 주세요.' }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
    })
    if (authError) {
      if (authError.message.includes('already been registered')) return { ok: false, error: '이미 있는 이메일이에요.' }
      return { ok: false, error: authError.message }
    }
    const userId = userData.user?.id
    if (!userId) return { ok: false, error: '유저 생성 후 ID를 받지 못했어요.' }

    const anonName = (formData.anon_name ?? '').trim() || generateAnonName()
    await supabaseAdmin.from('profiles').insert({ user_id: userId, anon_name: anonName })
    await supabaseAdmin.from('seed_accounts').insert({ user_id: userId, email })
    return { ok: true as const }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '계정 생성 실패' }
  }
}

export type BulkResult = { ok: true; created: number; skipped: number } | { ok: false; error: string }

export async function createSeedAccountsBulk(formData: {
  prefix: string
  start: number
  end: number
  domain: string
}): Promise<BulkResult> {
  const admin = await ensureAdmin()
  if (!admin.ok) return admin

  const prefix = String(formData.prefix ?? '').trim()
  const domain = String(formData.domain ?? '').trim() || '@gmail.com'
  const start = Math.max(0, Number(formData.start) || 0)
  const end = Math.max(start, Number(formData.end) || start)
  const limit = 500
  if (end - start + 1 > limit) return { ok: false, error: `한 번에 ${limit}개까지만 생성할 수 있어요.` }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    let created = 0
    let skipped = 0
    for (let i = start; i <= end; i++) {
      const email = `${prefix}${i}${domain}`.toLowerCase()
      const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: SEED_PASSWORD,
        email_confirm: true,
      })
      if (authError) {
        if (authError.message.includes('already been registered')) skipped++
        else skipped++
        continue
      }
      const userId = userData.user?.id
      if (!userId) { skipped++; continue }
      try {
        await supabaseAdmin.from('profiles').insert({ user_id: userId, anon_name: generateAnonName() })
        await supabaseAdmin.from('seed_accounts').insert({ user_id: userId, email })
        created++
      } catch {
        skipped++
      }
    }
    return { ok: true, created, skipped }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '벌크 생성 실패' }
  }
}

export type SeedAccountRow = { user_id: string; email: string; created_at: string }

export async function getSeedAccountsList(): Promise<
  { ok: true; list: SeedAccountRow[] } | { ok: false; error: string }
> {
  const admin = await ensureAdmin()
  if (!admin.ok) return admin

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('seed_accounts')
      .select('user_id, email, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return { ok: false, error: error.message }
    return { ok: true, list: (data ?? []) as SeedAccountRow[] }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '목록 조회 실패' }
  }
}
