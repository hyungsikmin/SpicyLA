-- Post reactions: one reaction per user per post (emoji 🌶️)
create table public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create index post_reactions_post_id_idx on public.post_reactions(post_id);

alter table public.post_reactions enable row level security;

-- Anyone can read (for counts)
create policy "post_reactions_select"
  on public.post_reactions for select
  using (true);

-- Authenticated users can insert own reaction
create policy "post_reactions_insert"
  on public.post_reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can delete own reaction (optional: for "unreact")
create policy "post_reactions_delete_own"
  on public.post_reactions for delete
  using (auth.uid() = user_id);
