-- 점메추: 관리자가 마감 시각을 변경했을 때, 이미 존재하는 오늘 라운드의 deadline_at을
-- 현재 설정(lunch_deadline_hour, timezone)에 맞게 동기화. 카운트다운이 새 마감 시각을 반영하도록 함.

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
    -- 관리자가 마감 시각을 변경한 경우: 오픈 중인 라운드의 deadline_at을 현재 설정에 맞게 갱신.
    if r.status = 'open' and r.deadline_at is distinct from deadline_ts then
      update public.lunch_rounds set deadline_at = deadline_ts where id = r.id;
      select * into r from public.lunch_rounds where id = r.id limit 1;
    end if;
    -- 기존 라운드도 마감 시각 지났으면 여기서 마감 후 갱신된 행 반환.
    if r.status = 'open' and r.deadline_at <= now() then
      perform public.close_lunch_round_and_set_winner(r.id);
      select * into r from public.lunch_rounds where id = r.id limit 1;
    end if;
    return r;
  end if;

  insert into public.lunch_rounds (round_date, deadline_at, status)
  values (today_la, deadline_ts, 'open')
  returning * into r;

  if deadline_ts <= now() then
    perform public.close_lunch_round_and_set_winner(r.id);
    select * into r from public.lunch_rounds where id = r.id limit 1;
  end if;

  return r;
end;
$$;

comment on function public.get_or_create_today_lunch_round(text, int) is '오늘(LA) 점메추 라운드 반환. 없으면 생성. 기존 오픈 라운드는 설정 변경 시 deadline_at 동기화. 마감 시각 지났으면 즉시 마감·우승 처리';
