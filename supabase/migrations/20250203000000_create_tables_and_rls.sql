-- Create tables
create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  anon_name text,
  created_at timestamptz default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  body text not null,
  is_spicy boolean default false,
  status text default 'visible',
  created_at timestamptz default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text,
  target_id uuid,
  reason text,
  created_at timestamptz default now()
);

-- Indexes
create index posts_created_at_idx on public.posts(created_at);
create index comments_post_id_created_at_idx on public.comments(post_id, created_at);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;

-- profiles: user can select and update only own row
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id);

-- posts: anyone can select where status = 'visible'; authenticated can insert; users can update/delete own posts
create policy "posts_select_visible"
  on public.posts for select
  using (status = 'visible');

create policy "posts_insert_authenticated"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "posts_update_own"
  on public.posts for update
  using (auth.uid() = user_id);

create policy "posts_delete_own"
  on public.posts for delete
  using (auth.uid() = user_id);

-- comments: anyone can select comments for visible posts; authenticated can insert; users can delete own comments
create policy "comments_select_visible_posts"
  on public.comments for select
  using (
    exists (
      select 1 from public.posts
      where posts.id = comments.post_id
      and posts.status = 'visible'
    )
  );

create policy "comments_insert_authenticated"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "comments_delete_own"
  on public.comments for delete
  using (auth.uid() = user_id);

-- reports: authenticated users can insert; only admin can select
create policy "reports_insert_authenticated"
  on public.reports for insert
  to authenticated
  with check (true);

create policy "reports_select_admin"
  on public.reports for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
