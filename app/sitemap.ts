import type { MetadataRoute } from 'next'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

/** 재검증 주기(초). 배포 플랫폼에서 sitemap 캐시/재생성에 사용할 수 있음 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const root = baseUrl?.replace(/\/$/, '') ?? 'https://example.com'

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: root, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${root}/support`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ]

  const postUrls: MetadataRoute.Sitemap = []
  try {
    const admin = getSupabaseAdmin()
    const { data: posts } = await admin
      .from('posts')
      .select('id, updated_at')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(2000)
    if (posts?.length) {
      postUrls.push(
        ...posts.map((p: { id: string; updated_at?: string }) => ({
          url: `${root}/p/${p.id}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }))
      )
    }
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY 미설정 등으로 실패 시 게시글 URL 없이 진행
  }

  return [...staticRoutes, ...postUrls]
}
