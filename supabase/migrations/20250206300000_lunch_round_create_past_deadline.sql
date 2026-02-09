-- 점메추: 오늘 라운드 생성 시 이미 마감 시각이 지났으면 생성 직후 마감 처리
-- (그렇지 않으면 "open"인데 deadline 지난 라운드가 생겨, 첫 로드 시 closeRoundIfNeeded로
--  즉시 마감되어 한 명만 올리고 반응 받은 상태에서 점메추왕이 되고 다른 사람은 못 올리는 현상 발생)

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
    -- 기존 라운드도 마감 시각 지났으면 여기서 마감 후 갱신된 행 반환.
    -- 그래야 클라이언트가 첫 로드에서 open 받고 closeRoundIfNeeded 호출했다가
    -- 두 번째 로드에서 closed 받으면서 "참여 0" → "점메추왕 1명"으로 바뀌는 현상이 없음.
    if r.status = 'open' and r.deadline_at <= now() then
      perform public.close_lunch_round_and_set_winner(r.id);
      select * into r from public.lunch_rounds where id = r.id limit 1;
    end if;
    return r;
  end if;

  insert into public.lunch_rounds (round_date, deadline_at, status)
  values (today_la, deadline_ts, 'open')
  returning * into r;

  -- 이미 마감 시각이 지났으면 생성 직후 마감·우승 처리. 그래야 클라이언트가 "open"인데
  -- deadline 지난 라운드를 받아서 closeRoundIfNeeded 호출하는 일이 없음.
  if deadline_ts <= now() then
    perform public.close_lunch_round_and_set_winner(r.id);
    select * into r from public.lunch_rounds where id = r.id limit 1;
  end if;

  return r;
end;
$$;

comment on function public.get_or_create_today_lunch_round(text, int) is '오늘(LA) 점메추 라운드 반환. 없으면 생성. 생성 시점에 이미 마감 시각 지났으면 즉시 마감·우승 처리';
