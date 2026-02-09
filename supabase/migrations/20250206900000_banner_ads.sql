-- 배너 광고: 슬롯별 여러 광고 등록, 로테이션 노출
create table if not exists public.banner_ads (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null,
  image_url text not null,
  link_url text not null,
  alt_text text,
  sort_order int not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz default now()
);

comment on table public.banner_ads is '배너 광고. slot_key별 여러 행 = 로테이션 노출. 관리자 대시보드에서 CRUD.';

create index if not exists banner_ads_slot_key_idx on public.banner_ads (slot_key);
create index if not exists banner_ads_starts_ends_idx on public.banner_ads (starts_at, ends_at);

alter table public.banner_ads enable row level security;

-- 모든 사용자(비로그인 포함)가 현재 노출 가능한 광고 조회
create policy "banner_ads_select"
  on public.banner_ads for select
  using (true);

-- 관리자만 insert/update/delete
create policy "banner_ads_admin_insert"
  on public.banner_ads for insert
  to authenticated
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "banner_ads_admin_update"
  on public.banner_ads for update
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "banner_ads_admin_delete"
  on public.banner_ads for delete
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
