-- 1인 1라운드 여러 추천 허용: unique (round_id, user_id) 제거
alter table if exists public.lunch_recommendations
  drop constraint if exists lunch_recommendations_round_id_user_id_key;

comment on table public.lunch_recommendations is '점메추 추천. 1인 1라운드 여러 건 가능';
