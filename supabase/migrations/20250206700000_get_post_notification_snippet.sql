-- RPC: return a short title/snippet for a post for use in global notifications (poll question, post title, or body).
-- Uses SECURITY DEFINER so the realtime handler can get the snippet without RLS blocking.
create or replace function public.get_post_notification_snippet(p_post_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    case when length(t) > 20 then left(t, 20) || '…' else t end
  from (
    select coalesce(
      nullif(trim((select question from post_polls where post_id = p_post_id limit 1)), ''),
      nullif(trim((select title from posts where id = p_post_id and status = 'visible' limit 1)), ''),
      nullif(trim(left((select body from posts where id = p_post_id and status = 'visible' limit 1), 500)), '')
    ) as t
  ) x
  where t is not null and length(trim(t)) > 0
  limit 1;
$$;

comment on function public.get_post_notification_snippet(uuid) is 'Returns a short snippet (poll question, post title, or body) for notification display; used by global notification handlers.';
