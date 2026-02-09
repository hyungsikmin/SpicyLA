import { supabase } from '@/lib/supabaseClient'

const DEFAULTS = {
  best_comment_min_likes: 1,
  trending_min_count: 10,
  trending_max: 3,
  popular_members_count: 10,
  popular_members_min_score: 0,
  banner_rotation_seconds_default: 3,
  banner_in_feed_every_n_posts: 5,
} as const

const BANNER_ROTATION_PREFIX = 'banner_rotation:'

export type SiteSettings = {
  best_comment_min_likes: number
  trending_min_count: number
  trending_max: number
  popular_members_count: number
  popular_members_min_score: number
  /** 슬롯별 로테이션 전환 간격(초). 없으면 banner_rotation_seconds_default 사용 */
  banner_rotation_by_slot: Record<string, number>
  banner_in_feed_every_n_posts: number
}

export function getBannerRotationSeconds(settings: SiteSettings, slotKey: string): number {
  return settings.banner_rotation_by_slot[slotKey] ?? DEFAULTS.banner_rotation_seconds_default
}

export type Tier = {
  id: string
  name: string
  min_posts: number
  min_comments: number
  min_reactions: number
  sort_order: number
  badge_color: string | null
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data } = await supabase.from('site_settings').select('key, value_json')
  const map = new Map<string, number>()
  const bannerRotationBySlot: Record<string, number> = {}
  ;(data ?? []).forEach((row: { key: string; value_json: unknown }) => {
    const v = row.value_json
    const num = typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^-?\d+$/.test(v) ? parseInt(v, 10) : null
    if (num == null) return
    if (row.key.startsWith(BANNER_ROTATION_PREFIX)) {
      const slotKey = row.key.slice(BANNER_ROTATION_PREFIX.length)
      bannerRotationBySlot[slotKey] = num
    } else {
      map.set(row.key, num)
    }
  })
  return {
    best_comment_min_likes: map.get('best_comment_min_likes') ?? DEFAULTS.best_comment_min_likes,
    trending_min_count: map.get('trending_min_count') ?? DEFAULTS.trending_min_count,
    trending_max: map.get('trending_max') ?? DEFAULTS.trending_max,
    popular_members_count: map.get('popular_members_count') ?? DEFAULTS.popular_members_count,
    popular_members_min_score: map.get('popular_members_min_score') ?? DEFAULTS.popular_members_min_score,
    banner_rotation_by_slot: bannerRotationBySlot,
    banner_in_feed_every_n_posts: map.get('banner_in_feed_every_n_posts') ?? DEFAULTS.banner_in_feed_every_n_posts,
  }
}

export async function fetchTiers(): Promise<Tier[]> {
  const { data } = await supabase
    .from('tiers')
    .select('id, name, min_posts, min_comments, min_reactions, sort_order, badge_color')
    .order('sort_order', { ascending: true })
  return (data ?? []) as Tier[]
}

/** 사용자가 충족하는 최고 등급( sort_order 기준). 없으면 null */
export function resolveTier(
  tiers: Tier[],
  postsCount: number,
  commentsCount: number,
  reactionsCount: number
): Tier | null {
  const sorted = [...tiers].sort((a, b) => b.sort_order - a.sort_order)
  for (const t of sorted) {
    if (
      postsCount >= t.min_posts &&
      commentsCount >= t.min_comments &&
      reactionsCount >= t.min_reactions
    ) {
      return t
    }
  }
  return null
}
