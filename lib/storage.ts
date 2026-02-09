const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const BUCKET = 'post-images'
const AVATARS_BUCKET = 'avatars'
const BUSINESS_SPOTLIGHT_BUCKET = 'business-spotlight'
export const BANNER_ADS_BUCKET = 'banner-ads'

export function getPostImageUrl(filePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`
}

export function getAvatarUrl(avatarPath: string | null): string | null {
  if (!avatarPath) return null
  return `${SUPABASE_URL}/storage/v1/object/public/${AVATARS_BUCKET}/${avatarPath}`
}

export function getBusinessSpotlightMediaUrl(mediaPath: string | null): string | null {
  if (!mediaPath) return null
  return `${SUPABASE_URL}/storage/v1/object/public/${BUSINESS_SPOTLIGHT_BUCKET}/${mediaPath}`
}

export function getBannerAdImageUrl(filePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BANNER_ADS_BUCKET}/${filePath}`
}
