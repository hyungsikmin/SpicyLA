-- Site-wide settings (베스트 댓글, 트렌딩 자격 등)
create table if not exists public.site_settings (
  key text primary key,
  value_json jsonb not null default 'null'
);

alter table public.site_settings enable row level security;

create policy "site_settings_select"
  on public.site_settings for select
  using (true);

create policy "site_settings_admin"
  on public.site_settings for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

insert into public.site_settings (key, value_json)
values
  ('best_comment_min_likes', '1'),
  ('trending_min_count', '10'),
  ('trending_max', '3')
on conflict (key) do nothing;

-- 등급 (썰쟁이 등): 자격 요건 및 표시 순서
create table if not exists public.tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_posts int not null default 0,
  min_comments int not null default 0,
  min_reactions int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

alter table public.tiers enable row level security;

create policy "tiers_select"
  on public.tiers for select
  using (true);

create policy "tiers_admin"
  on public.tiers for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

insert into public.tiers (name, min_posts, min_comments, min_reactions, sort_order)
select '썰쟁이', 2, 0, 0, 1
where not exists (select 1 from public.tiers limit 1);
