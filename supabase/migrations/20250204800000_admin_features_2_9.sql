-- 2. 신고 시 신고자 표시
alter table public.reports
  add column if not exists reporter_id uuid references auth.users on delete set null;
comment on column public.reports.reporter_id is '신고한 유저 (관리자만 조회)';

-- 6. 공지/고정글
alter table public.posts
  add column if not exists pinned_at timestamptz;
comment on column public.posts.pinned_at is '상단 고정 시각. null이면 고정 아님. 관리자만 설정';

-- 7. 정지 사유·기간
alter table public.site_bans
  add column if not exists expires_at timestamptz;
comment on column public.site_bans.expires_at is '정지 만료 시각. null이면 무기한';

-- 정지 RLS: 만료된 정지는 미적용 (posts/comments insert에서 제외)
drop policy if exists "posts_insert_authenticated" on public.posts;
create policy "posts_insert_authenticated"
  on public.posts for insert to authenticated
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.site_bans b
      where b.user_id = auth.uid()
      and (b.expires_at is null or b.expires_at > now())
    )
  );

drop policy if exists "comments_insert_authenticated" on public.comments;
create policy "comments_insert_authenticated"
  on public.comments for insert to authenticated
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.site_bans b
      where b.user_id = auth.uid()
      and (b.expires_at is null or b.expires_at > now())
    )
  );

-- 8. 관리자 활동 로그
create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users on delete cascade,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);
create index if not exists admin_activity_log_created_at_idx on public.admin_activity_log(created_at desc);
comment on table public.admin_activity_log is '관리자 활동 로그 (삭제/숨김/정지 등)';

alter table public.admin_activity_log enable row level security;
create policy "admin_activity_log_admin_insert"
  on public.admin_activity_log for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or exists (select 1 from public.admin_users where user_id = auth.uid())
  );
create policy "admin_activity_log_admin_select"
  on public.admin_activity_log for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- 9. 비즈니스 스팟라이트 순서·숨김
alter table public.business_spotlight
  add column if not exists sort_order int default 0,
  add column if not exists is_hidden boolean default false;
comment on column public.business_spotlight.sort_order is '노출 순서. 작을수록 앞';
comment on column public.business_spotlight.is_hidden is 'true면 목록/홈에서 숨김';

-- 관리자: 비즈니스 스팟라이트 순서·숨김 수정
create policy "business_spotlight_update_admin"
  on public.business_spotlight for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or exists (select 1 from public.admin_users where user_id = auth.uid())
  );
