export const AVATAR_COLORS = [
  'bg-[#fef3c7]',
  'bg-[#fce7f3]',
  'bg-[#d1fae5]',
  'bg-[#dbeafe]',
  'bg-[#e9d5ff]',
  'bg-[#ffedd5]',
]
export const IRIDESCENT_CLASS = 'bg-gradient-to-br from-pink-300/80 via-purple-300/80 to-amber-300/80 dark:from-pink-400/70 dark:via-purple-400/70 dark:to-amber-400/70'

export function getAvatarColorClass(profileColorIndex: number | null, userId: string): string {
  const defaultIndex = Math.abs([...userId].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0) | 0, 0)) % 6
  if (profileColorIndex === 6) return IRIDESCENT_CLASS
  if (profileColorIndex != null && profileColorIndex >= 0 && profileColorIndex < AVATAR_COLORS.length) return AVATAR_COLORS[profileColorIndex]
  return AVATAR_COLORS[defaultIndex]
}
