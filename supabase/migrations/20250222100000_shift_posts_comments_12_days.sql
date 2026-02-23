-- 포스트·댓글 시간 +12일 (2월 9일 → 2월 21일 등). 시간은 동일 유지.
update public.posts
set created_at = created_at + interval '12 days'
where true;

update public.posts
set pinned_at = pinned_at + interval '12 days'
where pinned_at is not null;

update public.comments
set created_at = created_at + interval '12 days'
where true;
