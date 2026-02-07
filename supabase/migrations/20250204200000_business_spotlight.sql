-- LA 20·30 자영업/스타트업 홍보용 스팟라이트
create table if not exists public.business_spotlight (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  business_name text not null,
  one_liner text,
  link_url text,
  created_at timestamptz default now()
);

create index if not exists business_spotlight_created_at_idx on public.business_spotlight(created_at desc);
comment on table public.business_spotlight is 'LA 20·30 자영업/스타트업 비즈니스 소개·홍보';

alter table public.business_spotlight enable row level security;

-- 누구나 목록 조회 (공개 홍보)
create policy "business_spotlight_select"
  on public.business_spotlight for select
  using (true);

-- 본인만 등록
create policy "business_spotlight_insert_own"
  on public.business_spotlight for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 본인만 수정/삭제
create policy "business_spotlight_update_own"
  on public.business_spotlight for update
  using (auth.uid() = user_id);

create policy "business_spotlight_delete_own"
  on public.business_spotlight for delete
  using (auth.uid() = user_id);
