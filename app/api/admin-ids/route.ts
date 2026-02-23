/**
 * Returns list of admin user_ids for badge display (관리자 뱃지).
 * Uses service role so RLS does not restrict to current user.
 */
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin.from('admin_users').select('user_id')
    if (error) return NextResponse.json({ adminIds: [] }, { status: 200 })
    const adminIds = (data ?? []).map((r: { user_id: string }) => r.user_id)
    return NextResponse.json({ adminIds })
  } catch {
    return NextResponse.json({ adminIds: [] }, { status: 200 })
  }
}
