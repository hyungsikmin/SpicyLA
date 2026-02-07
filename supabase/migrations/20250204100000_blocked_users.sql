-- Blocked users: who blocked whom
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id != blocked_id)
);

create index if not exists blocked_users_blocker_id_idx on public.blocked_users(blocker_id);

alter table public.blocked_users enable row level security;

create policy "blocked_users_select_own"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

create policy "blocked_users_insert_own"
  on public.blocked_users for insert
  to authenticated
  with check (auth.uid() = blocker_id);

create policy "blocked_users_delete_own"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);
