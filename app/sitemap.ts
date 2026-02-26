import type { MetadataRoute } from 'next'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

/** 재검증 주기(초). 배포 플랫폼에서 sitemap 캐시/재생성에 사용할 수 있음 */
export const revalidate = 3600

/** 빌드 시 정적 생성하지 않고 요청 시마다 실행해 DB에서 게시글 URL 가져옴 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const root = baseUrl?.replace(/\/$/, '') ?? 'https://example.com'

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: root, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${root}/support`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ]

  const postUrls: MetadataRoute.Sitemap = []
  try {
    const admin = getSupabaseAdmin()
    const { data: posts, error } = await admin
      .from('posts')
      .select('id, updated_at')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(2000)
    if (error) {
      console.error('[sitemap] Supabase query error:', error.message, error.code, error.details)
    } else if (posts?.length) {
      postUrls.push(
        ...posts.map((p: { id: string; updated_at?: string }) => ({
          url: `${root}/p/${p.id}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }))
      )
      console.log('[sitemap] Added post URLs:', postUrls.length)
    } else {
      console.log('[sitemap] No visible posts returned, count:', posts?.length ?? 0)
    }
  } catch (e) {
    console.error('[sitemap] catch:', e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack : '')
  }

  return [...staticRoutes, ...postUrls]
}
