-- 관리자 목록 (JWT app_metadata 대신 사용 가능)
-- 이 테이블에 있으면 관리자. SQL로 추가 후 로그인만 하면 됨.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz default now()
);

comment on table public.admin_users is '관리자 목록. 여기 있는 user_id는 관리자로 인식.';

alter table public.admin_users enable row level security;

-- 본인만 "내가 관리자인지" 조회 가능
create policy "admin_users_select_own"
  on public.admin_users for select
  using (auth.uid() = user_id);

-- 테이블이 비어 있을 때만 insert (첫 관리자 등록), 또는 이미 관리자인 사람만 insert
create policy "admin_users_insert"
  on public.admin_users for insert
  to authenticated
  with check (
    (select count(*) from public.admin_users) = 0
    or exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- 관리자만 삭제 가능 (다른 관리자 제거 시)
create policy "admin_users_delete"
  on public.admin_users for delete
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- 아래: admin_users 테이블에 있으면 관리자로 인식하도록 기존 admin 정책과 동등한 정책 추가 (OR로 적용됨)
-- reports
create policy "reports_select_admin_users"
  on public.reports for select
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- site_bans
create policy "site_bans_admin_users_all"
  on public.site_bans for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- posts (delete, update for admin)
create policy "posts_delete_admin_users"
  on public.posts for delete
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "posts_update_admin_users"
  on public.posts for update
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "posts_select_admin_users"
  on public.posts for select
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- comments (delete, select for admin)
create policy "comments_delete_admin_users"
  on public.comments for delete
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "comments_select_admin_users"
  on public.comments for select
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
