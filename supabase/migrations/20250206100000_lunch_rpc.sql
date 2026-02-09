-- 점메추: 오늘(LA) 라운드 조회/생성, 마감 및 우승 처리

-- 오늘(LA 기준) round_date에 해당하는 라운드 반환. 없으면 생성 후 반환.
create or replace function public.get_or_create_today_lunch_round(
  p_timezone text default 'America/Los_Angeles',
  p_deadline_hour int default 12
)
returns public.lunch_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  today_la date;
  deadline_ts timestamptz;
  r public.lunch_rounds;
begin
  today_la := (now() at time zone p_timezone)::date;
  deadline_ts := (today_la || ' ' || p_deadline_hour || ':00:00')::timestamp at time zone p_timezone;

  select * into r from public.lunch_rounds where round_date = today_la limit 1;
  if r.id is not null then
    return r;
  end if;

  insert into public.lunch_rounds (round_date, deadline_at, status)
  values (today_la, deadline_ts, 'open')
  returning * into r;
  return r;
end;
$$;

comment on function public.get_or_create_today_lunch_round(text, int) is '오늘(LA) 점메추 라운드 반환. 없으면 생성';

-- 라운드 마감: deadline 지났으면 status=closed, 점수로 우승자 결정 후 winner_recommendation_id 및 profiles.lunch_winner_at 설정
create or replace function public.close_lunch_round_and_set_winner(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  round_rec public.lunch_rounds;
  winner_id uuid;
  winner_user_id uuid;
  round_date_la date;
begin
  select * into round_rec from public.lunch_rounds where id = p_round_id;
  if round_rec.id is null or round_rec.status = 'closed' then
    return;
  end if;
  if now() < round_rec.deadline_at then
    return;
  end if;

  -- 점수: want=+2, unsure=0, wtf=-1. 최고점 추천 (동점이면 created_at 빠른 것)
  with scores as (
    select
      lr.id,
      lr.user_id,
      lr.created_at,
      coalesce(sum(
        case v.vote_type
          when 'want' then 2
          when 'unsure' then 0
          when 'wtf' then -1
          else 0
        end
      ), 0) as score
    from public.lunch_recommendations lr
    left join public.lunch_votes v on v.recommendation_id = lr.id
    where lr.round_id = p_round_id
    group by lr.id, lr.user_id, lr.created_at
  ),
  ranked as (
    select id, user_id, row_number() over (order by score desc, created_at asc) as rn
    from scores
  )
  select r.id, r.user_id into winner_id, winner_user_id
  from ranked r
  where r.rn = 1
  limit 1;

  round_date_la := round_rec.round_date;

  update public.lunch_rounds
  set status = 'closed', winner_recommendation_id = winner_id
  where id = p_round_id;

  if winner_user_id is not null then
    update public.profiles
    set lunch_winner_at = round_date_la
    where user_id = winner_user_id;
  end if;
end;
$$;

comment on function public.close_lunch_round_and_set_winner(uuid) is '점메추 라운드 마감 및 우승자 설정. deadline 지난 경우만 실행';
