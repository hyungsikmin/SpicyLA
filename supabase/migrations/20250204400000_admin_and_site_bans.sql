-- Site-wide bans (관리자 정지)
create table if not exists public.site_bans (
  user_id uuid primary key references auth.users on delete cascade,
  reason text,
  created_at timestamptz default now(),
  banned_by uuid references auth.users on delete set null
);

comment on table public.site_bans is '관리자에 의한 사이트 이용 정지';

alter table public.site_bans enable row level security;

create policy "site_bans_admin_all"
  on public.site_bans for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 정지된 유저는 글/댓글 작성 불가 (기존 정책과 함께 적용되므로 추가 정책으로 차단)
-- RLS는 OR로 묶이므로: insert 시 (본인이고 정지 아님) 필요. 기존은 with check (auth.uid() = user_id).
-- Postgres RLS: 여러 policy가 있으면 OR. So we need to DROP the existing insert and add one that also excludes banned.
-- Safer: create a policy that rejects when in site_bans. But "reject" is done by not having a matching policy.
-- So: add policy that allows insert only when NOT in site_bans. We can't do "allow when not in" easily without replacing.
-- Approach: add a policy "posts_insert_not_banned" that allows insert for authenticated when auth.uid() not in (select user_id from site_bans).
-- But then we have two insert policies (posts_insert_authenticated and posts_insert_not_banned). For insert, WITH CHECK is applied. So if we have
-- posts_insert_authenticated: with check (auth.uid() = user_id)  -> allows all own posts
-- we need to restrict. So the only way is to replace the insert policy with one that also checks not in site_bans.
-- Let me create a new policy that allows insert only when not banned. In Postgres, for INSERT, if ANY policy passes, it's allowed. So we need
-- to REMOVE the existing insert policy and add a single one: with check (auth.uid() = user_id and not exists (select 1 from site_bans where user_id = auth.uid())).
-- So we drop and recreate.

drop policy if exists "posts_insert_authenticated" on public.posts;
create policy "posts_insert_authenticated"
  on public.posts for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.site_bans where site_bans.user_id = auth.uid())
  );

drop policy if exists "comments_insert_authenticated" on public.comments;
create policy "comments_insert_authenticated"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.site_bans where site_bans.user_id = auth.uid())
  );

-- Admin: delete any post (soft delete = status update, or hard delete)
create policy "posts_delete_admin"
  on public.posts for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin: update post (e.g. set status = 'hidden')
create policy "posts_update_admin"
  on public.posts for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin: delete any comment
create policy "comments_delete_admin"
  on public.comments for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin: select all comments (for dashboard)
create policy "comments_select_admin"
  on public.comments for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin: select all posts (including hidden) for dashboard
create policy "posts_select_admin"
  on public.posts for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
