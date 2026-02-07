-- Comment likes (하트): one row per user per comment
create table public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);

create index comment_likes_comment_id_idx on public.comment_likes(comment_id);
create index comment_likes_user_id_idx on public.comment_likes(user_id);

alter table public.comment_likes enable row level security;

-- Select: allowed for comments on visible posts
create policy "comment_likes_select_visible"
  on public.comment_likes for select
  using (
    exists (
      select 1 from public.comments c
      join public.posts p on p.id = c.post_id
      where c.id = comment_likes.comment_id and p.status = 'visible'
    )
  );

-- Insert: authenticated, own user_id
create policy "comment_likes_insert_own"
  on public.comment_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Delete: own like
create policy "comment_likes_delete_own"
  on public.comment_likes for delete
  using (auth.uid() = user_id);
