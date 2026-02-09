/**
 * 배너 광고 슬롯 정의. 코드에서 고정, 관리자는 해당 슬롯에 들어갈 광고만 CRUD.
 */
export const BANNER_SLOTS = [
  { key: 'home-below-header', label: '홈 헤더 바로 아래' },
  { key: 'home-between-trending-lunch', label: '홈 트렌딩 ↔ 점메추 사이' },
  { key: 'home-between-lunch-feed', label: '홈 점메추 ↔ 피드 사이' },
  { key: 'home-in-feed', label: '홈 피드 중간 (N개 글마다)' },
  { key: 'home-bottom-sticky', label: '홈 하단 고정 (네비 위)' },
  { key: 'post-below-content', label: '글 상세 본문 아래 / 댓글 위' },
] as const

export type BannerSlotKey = (typeof BANNER_SLOTS)[number]['key']

export function getBannerSlotLabel(key: string): string {
  return BANNER_SLOTS.find((s) => s.key === key)?.label ?? key
}
