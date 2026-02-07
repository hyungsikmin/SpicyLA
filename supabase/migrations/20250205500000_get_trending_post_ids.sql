-- 트렌딩: 리액션 수 기준 상위 N개 (전체 글 대상, 첫 10개 제한 아님).
-- 적용 방법: npx supabase db push 또는 Supabase 대시보드 SQL Editor에서 이 파일 내용 실행.
-- 미적용 시 앱은 피드에 이미 로드된 글만 트렌딩 후보로 사용(11번째 이후 글은 트렌딩에 안 나올 수 있음).
create or replace function public.get_trending_post_ids(p_min_count int, p_max_count int)
returns table(post_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id as post_id
  from posts p
  inner join (
    select post_id, count(*) as cnt
    from post_reactions
    group by post_id
  ) pr on pr.post_id = p.id
  where p.status = 'visible'
    and pr.cnt >= p_min_count
  order by pr.cnt desc, p.created_at desc, p.id desc
  limit greatest(0, p_max_count);
$$;

comment on function public.get_trending_post_ids(int, int) is '리액션 수가 p_min_count 이상인 글 중 상위 p_max_count개 id 반환 (트렌딩용)';
