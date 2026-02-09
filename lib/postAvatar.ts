const AVATAR_EMOJIS = [
  '🦊', '🐸', '🐱', '🦉', '🐻', '🐶', '🐹', '🦁', '🐯', '🐵', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔',
]
const AVATAR_COLORS = ['bg-amber-500/20', 'bg-rose-500/20', 'bg-emerald-500/20', 'bg-sky-500/20', 'bg-violet-500/20', 'bg-orange-500/20']

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return Math.abs(h)
}

export function postAvatarEmoji(postId: string): string {
  return AVATAR_EMOJIS[hashStr(postId) % AVATAR_EMOJIS.length]
}

export function postAvatarColor(postId: string): string {
  return AVATAR_COLORS[hashStr(postId) % AVATAR_COLORS.length]
}

/** 같은 user_id면 피드/상세/댓글 어디서나 동일한 이모지·색 (프로필 싱크) */
export function userAvatarEmoji(userId: string): string {
  return AVATAR_EMOJIS[hashStr(userId) % AVATAR_EMOJIS.length]
}

export function userAvatarColor(userId: string): string {
  return AVATAR_COLORS[hashStr(userId) % AVATAR_COLORS.length]
}
