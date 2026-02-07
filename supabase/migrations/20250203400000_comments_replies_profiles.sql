-- Comments: allow one level of reply (대댓글)
alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_id_idx on public.comments(parent_id);

-- Only allow reply to top-level comments (enforced in app: parent must have parent_id null)
comment on column public.comments.parent_id is 'Null = top-level; set = reply to that comment (1 level only)';

-- Profiles: allow reading anon_name for display (댓글/포스트 작성자 표시, 멘션)
create policy "profiles_select_public"
  on public.profiles for select
  using (true);
