-- 모바일/데스크톱 구분용 device 컬럼 추가
alter table public.visitor_pings
  add column if not exists device text;

comment on column public.visitor_pings.device is 'mobile | desktop. null이면 기존 데이터(desktop으로 집계)';
