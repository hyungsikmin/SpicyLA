-- 연락처·이메일 (비공개 선택시 운영자에게만 공개)
alter table public.business_spotlight
  add column if not exists contact text,
  add column if not exists contact_private boolean default false,
  add column if not exists email text,
  add column if not exists email_private boolean default false,
  add column if not exists approved boolean default false;

comment on column public.business_spotlight.contact is '연락처. contact_private=true면 관리자만 조회';
comment on column public.business_spotlight.contact_private is 'true면 연락처를 운영자에게만 공개';
comment on column public.business_spotlight.email is '이메일. email_private=true면 관리자만 조회';
comment on column public.business_spotlight.email_private is 'true면 이메일을 운영자에게만 공개';
comment on column public.business_spotlight.approved is 'true면 홈/목록에 노출. 관리자 수락 후 true';
