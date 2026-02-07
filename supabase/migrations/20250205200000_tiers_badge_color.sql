-- 등급별 뱃지 컬러 (hex 또는 CSS 색상값, null이면 기본 --spicy 사용)
alter table public.tiers
  add column if not exists badge_color text;

comment on column public.tiers.badge_color is '등급 뱃지 색상 (hex 또는 CSS). null이면 기본 액센트 사용';

-- 인기 멤버 설정 기본값
insert into public.site_settings (key, value_json)
values
  ('popular_members_count', '10'),
  ('popular_members_min_score', '0')
on conflict (key) do nothing;
