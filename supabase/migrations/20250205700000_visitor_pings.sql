-- 접속/방문 집계 (현재 접속자, 시간별 그래프용)
create table if not exists public.visitor_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists visitor_pings_created_at_idx on public.visitor_pings(created_at);
create index if not exists visitor_pings_session_id_idx on public.visitor_pings(session_id);

alter table public.visitor_pings enable row level security;

-- 누구나 ping 기록 가능 (앱에서 호출)
create policy "visitor_pings_insert"
  on public.visitor_pings for insert
  with check (true);

-- 관리자만 조회
create policy "visitor_pings_admin_select"
  on public.visitor_pings for select
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

comment on table public.visitor_pings is '방문/접속 ping. session_id로 현재 접속자, created_at으로 시간별 집계';

-- 최근 5분 내 접속한 고유 세션 수 (현재 접속자)
create or replace function public.get_current_online_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct session_id)::int
  from visitor_pings
  where created_at > now() - interval '5 minutes';
$$;
