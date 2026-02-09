'use server'

import { createSupabaseServer } from '@/lib/supabaseServer'
import { BANNER_SLOTS } from '@/lib/bannerSlots'

export type BannerAdRow = {
  id: string
  slot_key: string
  image_url: string
  link_url: string
  alt_text: string | null
  sort_order: number
  starts_at: string
  ends_at: string | null
  created_at: string
}

async function ensureAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }
  const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) return { ok: false, error: '관리자만 사용할 수 있어요.' }
  return { ok: true }
}

export async function getBannerAdCounts(): Promise<
  { ok: true; counts: Record<string, number> } | { ok: false; error: string }
> {
  const admin = await ensureAdmin()
  if (!admin.ok) return admin
  const supabase = await createSupabaseServer()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('banner_ads')
    .select('slot_key')
  if (error) return { ok: false, error: error.message }
  const counts: Record<string, number> = {}
  for (const s of BANNER_SLOTS) counts[s.key] = 0
  ;(data ?? []).forEach((row: { slot_key: string }) => {
    counts[row.slot_key] = (counts[row.slot_key] ?? 0) + 1
  })
  return { ok: true, counts }
}

export async function getBannerAdsBySlot(slotKey: string): Promise<
  { ok: true; ads: BannerAdRow[] } | { ok: false; error: string }
> {
  const admin = await ensureAdmin()
  if (!admin.ok) return admin
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('banner_ads')
    .select('id, slot_key, image_url, link_url, alt_text, sort_order, starts_at, ends_at, created_at')
    .eq('slot_key', slotKey)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, ads: (data ?? []) as BannerAdRow[] }
}

export async function createBannerAd(form: {
  slot_key: string
  image_url: string
  link_url: string
  alt_text?: string
  sort_order?: number
  starts_at: string
  ends_at?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await ensureAdmin()
  if (!admin.ok) return admin
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('banner_ads').insert({
    slot_key: form.slot_key.trim(),
    image_url: form.image_url.trim(),
    link_url: form.link_url.trim(),
    alt_text: form.alt_text?.trim() || null,
    sort_order: form.sort_order ?? 0,
    starts_at: form.starts_at,
    ends_at: form.ends_at || null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function updateBannerAd(
  id: string,
  form: {
    image_url?: string
    link_url?: string
    alt_text?: string | null
    sort_order?: number
    starts_at?: string
    ends_at?: string | null
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await ensureAdmin()
  if (!admin.ok) return admin
  const supabase = await createSupabaseServer()
  const payload: Record<string, unknown> = {}
  if (form.image_url !== undefined) payload.image_url = form.image_url.trim()
  if (form.link_url !== undefined) payload.link_url = form.link_url.trim()
  if (form.alt_text !== undefined) payload.alt_text = form.alt_text?.trim() || null
  if (form.sort_order !== undefined) payload.sort_order = form.sort_order
  if (form.starts_at !== undefined) payload.starts_at = form.starts_at
  if (form.ends_at !== undefined) payload.ends_at = form.ends_at || null
  const { error } = await supabase.from('banner_ads').update(payload).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteBannerAd(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await ensureAdmin()
  if (!admin.ok) return admin
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('banner_ads').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Update sort_order for ads in a slot by providing ordered ids (index = sort_order). */
export async function reorderBannerAds(slotKey: string, orderedIds: string[]): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const admin = await ensureAdmin()
  if (!admin.ok) return admin
  const supabase = await createSupabaseServer()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('banner_ads').update({ sort_order: i }).eq('id', orderedIds[i]).eq('slot_key', slotKey)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}
