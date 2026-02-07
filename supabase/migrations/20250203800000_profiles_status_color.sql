-- 프로필 상태메시지·프로필 색 (회원정보 수정)
alter table public.profiles
  add column if not exists status text,
  add column if not exists profile_color_index smallint;

comment on column public.profiles.status is '상태메시지 e.g. LA 사는 직장인';
comment on column public.profiles.profile_color_index is '0-5 index for avatar background color';
