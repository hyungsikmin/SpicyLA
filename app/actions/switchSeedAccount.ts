'use server'

import { createSupabaseServer } from '@/lib/supabaseServer'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const SEED_EMAIL_REGEX = /^a(\d+)@gmail\.com$/i

export async function getSwitchSeedAccountLink(
  targetEmail: string,
  redirectTo?: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: '로그인이 필요해요.' }

  const isSeedCurrent = SEED_EMAIL_REGEX.test(user.email)
  let isAdmin = false
  if (!isSeedCurrent) {
    const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
    isAdmin = !!adminRow
  }
  if (!isSeedCurrent && !isAdmin) return { error: '시드 계정 또는 관리자만 사용할 수 있어요.' }

  const trimmed = targetEmail.trim().toLowerCase()
  if (!SEED_EMAIL_REGEX.test(trimmed)) return { error: '올바른 시드 이메일이 아니에요 (a1@gmail.com ~ a100@gmail.com).' }

  const origin = redirectTo ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://spicy-la.vercel.app')
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: trimmed,
    options: { redirectTo: `${origin}/` },
  })

  if (error) return { error: error.message }
  const linkData = data as { properties?: { action_link?: string }; action_link?: string }
  const url = linkData?.properties?.action_link ?? linkData?.action_link
  if (!url) return { error: '로그인 링크를 만들 수 없어요.' }
  return { url }
}
