-- 등급별 회원 수 (대시보드용). 각 유저는 조건을 만족하는 최상위 등급 1개만 카운트.
create or replace function public.get_tier_member_counts()
returns table(tier_id uuid, tier_name text, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with user_stats as (
    select pr.user_id,
      coalesce(pc.post_c, 0)::int as post_c,
      coalesce(cc.comment_c, 0)::int as comment_c,
      coalesce(rc.reaction_c, 0)::int as reaction_c
    from profiles pr
    left join (select user_id, count(*) as post_c from posts where status = 'visible' group by user_id) pc on pc.user_id = pr.user_id
    left join (select user_id, count(*) as comment_c from comments group by user_id) cc on cc.user_id = pr.user_id
    left join (select p.user_id, count(*) as reaction_c from post_reactions r join posts p on p.id = r.post_id where p.status = 'visible' group by p.user_id) rc on rc.user_id = pr.user_id
  ),
  tier_qualify as (
    select u.user_id, t.id as tier_id, t.sort_order,
      (u.post_c >= t.min_posts and u.comment_c >= t.min_comments and u.reaction_c >= t.min_reactions) as qualifies
    from user_stats u
    cross join tiers t
  ),
  user_best_tier as (
    select distinct on (user_id) user_id, tier_id
    from tier_qualify
    where qualifies
    order by user_id, sort_order desc
  )
  select t.id as tier_id, t.name as tier_name, count(ub.user_id)::bigint as member_count
  from tiers t
  left join user_best_tier ub on ub.tier_id = t.id
  group by t.id, t.name, t.sort_order
  order by t.sort_order;
$$;

comment on function public.get_tier_member_counts() is '등급별 회원 수 (각 유저는 최상위 등급 1개만 포함)';
