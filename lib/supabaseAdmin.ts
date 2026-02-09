/**
 * Supabase Admin client (service_role).
 * 서버 전용. Server Action, API Route, Server Component에서만 import.
 * 클라이언트 번들에 포함되면 안 됨.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getSupabaseAdmin() {
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set for admin operations')
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
