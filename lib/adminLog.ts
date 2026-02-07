import type { SupabaseClient } from '@supabase/supabase-js'

export async function logAdminAction(
  supabase: SupabaseClient,
  action: string,
  targetType: string,
  targetId: string | null,
  details?: Record<string, unknown>
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('admin_activity_log').insert({
    admin_id: user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details ?? null,
  })
}
