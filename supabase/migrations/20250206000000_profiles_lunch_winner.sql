-- 프로필에 점메추 우승일 (오늘의 점메추왕 뱃지용)
alter table public.profiles
  add column if not exists lunch_winner_at date;

comment on column public.profiles.lunch_winner_at is '해당 날짜에 점메추 우승. 오늘과 같으면 프로필/피드에 뱃지 표시';
