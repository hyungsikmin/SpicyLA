-- Post polls (Threads-style: question + 2-4 options, one vote per user)
create table public.post_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  question text not null,
  option_1 text not null,
  option_2 text not null,
  option_3 text,
  option_4 text,
  ends_at timestamptz,
  created_at timestamptz default now(),
  unique(post_id)
);

create table public.post_poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index smallint not null check (option_index >= 0 and option_index <= 3),
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create index post_poll_votes_post_id_idx on public.post_poll_votes(post_id);

alter table public.post_polls enable row level security;
alter table public.post_poll_votes enable row level security;

create policy "post_polls_select"
  on public.post_polls for select using (true);

create policy "post_polls_insert_authenticated"
  on public.post_polls for insert to authenticated
  with check (true);

create policy "post_poll_votes_select"
  on public.post_poll_votes for select using (true);

create policy "post_poll_votes_insert_own"
  on public.post_poll_votes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "post_poll_votes_delete_own"
  on public.post_poll_votes for delete using (auth.uid() = user_id);

-- Post pro/con (찬 vs 반, one vote per user)
create table public.post_procon (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id)
);

create table public.post_procon_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  side text not null check (side in ('pro', 'con')),
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create index post_procon_votes_post_id_idx on public.post_procon_votes(post_id);

alter table public.post_procon enable row level security;
alter table public.post_procon_votes enable row level security;

create policy "post_procon_select"
  on public.post_procon for select using (true);

create policy "post_procon_insert_authenticated"
  on public.post_procon for insert to authenticated
  with check (true);

create policy "post_procon_votes_select"
  on public.post_procon_votes for select using (true);

create policy "post_procon_votes_insert_own"
  on public.post_procon_votes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "post_procon_votes_update_own"
  on public.post_procon_votes for update using (auth.uid() = user_id);

create policy "post_procon_votes_delete_own"
  on public.post_procon_votes for delete using (auth.uid() = user_id);

-- RPC: best poll post by total votes (visible posts only, optional recency)
create or replace function public.get_best_poll_post()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select pp.post_id, count(ppv.id) as total_votes
    from post_polls pp
    join posts p on p.id = pp.post_id and p.status = 'visible'
    left join post_poll_votes ppv on ppv.post_id = pp.post_id
    group by pp.post_id
  )
  select json_build_object(
    'post_id', t.post_id,
    'total_votes', t.total_votes
  )
  from totals t
  order by t.total_votes desc, t.post_id desc
  limit 1;
$$;

-- RPC: best procon post by total votes (찬+반)
create or replace function public.get_best_procon_post()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select pc.post_id, count(pcv.id) as total_votes
    from post_procon pc
    join posts p on p.id = pc.post_id and p.status = 'visible'
    left join post_procon_votes pcv on pcv.post_id = pc.post_id
    group by pc.post_id
  )
  select json_build_object(
    'post_id', t.post_id,
    'total_votes', t.total_votes
  )
  from totals t
  order by t.total_votes desc, t.post_id desc
  limit 1;
$$;

comment on function public.get_best_poll_post() is 'Returns post_id and total_votes for the poll post with most votes';
comment on function public.get_best_procon_post() is 'Returns post_id and total_votes for the procon post with most votes';
