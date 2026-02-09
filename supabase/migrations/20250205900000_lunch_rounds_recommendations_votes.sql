-- 점메추(오늘의 점심 추천) daily ritual: 라운드, 추천, 투표

-- 라운드: 일 단위 (LA 기준)
create table if not exists public.lunch_rounds (
  id uuid primary key default gen_random_uuid(),
  round_date date not null unique,
  deadline_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  winner_recommendation_id uuid,
  created_at timestamptz default now()
);

comment on table public.lunch_rounds is '점메추 일별 라운드. round_date는 LA 기준 날짜';
comment on column public.lunch_rounds.deadline_at is '해당일 12:00 LA (UTC 저장)';
comment on column public.lunch_rounds.winner_recommendation_id is '우승 추천 (마감 후 설정)';

create index if not exists lunch_rounds_round_date_idx on public.lunch_rounds(round_date desc);

-- 추천: 1인 1라운드 1건
create table if not exists public.lunch_recommendations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.lunch_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_name text not null,
  location text,
  link_url text,
  one_line_reason text not null,
  created_at timestamptz default now(),
  unique (round_id, user_id)
);

comment on table public.lunch_recommendations is '점메추 추천. 1인 1라운드 1건';
create index if not exists lunch_recommendations_round_id_idx on public.lunch_recommendations(round_id);

-- 투표: 1인 1추천당 1표 (want/unsure/wtf)
create table if not exists public.lunch_votes (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.lunch_recommendations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote_type text not null check (vote_type in ('want', 'unsure', 'wtf')),
  created_at timestamptz default now(),
  unique (recommendation_id, user_id)
);

comment on table public.lunch_votes is '점메추 투표. want=+2, unsure=0, wtf=-1';
create index if not exists lunch_votes_recommendation_id_idx on public.lunch_votes(recommendation_id);

-- FK for winner (after lunch_recommendations exists)
alter table public.lunch_rounds
  add constraint lunch_rounds_winner_fk
  foreign key (winner_recommendation_id) references public.lunch_recommendations(id) on delete set null;

-- RLS
alter table public.lunch_rounds enable row level security;
alter table public.lunch_recommendations enable row level security;
alter table public.lunch_votes enable row level security;

-- lunch_rounds: anyone can read
create policy "lunch_rounds_select"
  on public.lunch_rounds for select
  using (true);

-- lunch_rounds insert: service role or RPC only (앱에서 "오늘 라운드 없으면 생성" 시 사용). authenticated만 허용하고 round_date 중복 방지는 unique로.
create policy "lunch_rounds_insert"
  on public.lunch_rounds for insert
  to authenticated
  with check (true);

-- lunch_recommendations: anyone can read (for round display)
create policy "lunch_recommendations_select"
  on public.lunch_recommendations for select
  using (true);

create policy "lunch_recommendations_insert"
  on public.lunch_recommendations for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.lunch_rounds r
      where r.id = round_id and r.status = 'open'
    )
  );

create policy "lunch_recommendations_update_own"
  on public.lunch_recommendations for update
  using (auth.uid() = user_id);

create policy "lunch_recommendations_delete_own"
  on public.lunch_recommendations for delete
  using (auth.uid() = user_id);

-- lunch_votes: anyone can read (for tally)
create policy "lunch_votes_select"
  on public.lunch_votes for select
  using (true);

create policy "lunch_votes_insert"
  on public.lunch_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "lunch_votes_update_own"
  on public.lunch_votes for update
  using (auth.uid() = user_id);

create policy "lunch_votes_delete_own"
  on public.lunch_votes for delete
  using (auth.uid() = user_id);
