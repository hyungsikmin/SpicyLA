-- Post media: images attached to a post (order = position, rightmost = thumbnail)
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  file_path text not null,
  position int not null,
  created_at timestamptz default now()
);

create index post_media_post_id_idx on public.post_media(post_id);

alter table public.post_media enable row level security;

-- Ownership check without being blocked by posts RLS
create or replace function public.post_owner_id(p_post_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select user_id from public.posts where id = p_post_id limit 1;
$$;

create policy "post_media_select"
  on public.post_media for select
  using (true);

create policy "post_media_insert"
  on public.post_media for insert
  to authenticated
  with check (auth.uid() = public.post_owner_id(post_id));

create policy "post_media_delete"
  on public.post_media for delete
  to authenticated
  using (auth.uid() = public.post_owner_id(post_id));

-- Storage bucket for post images (public read).
-- Limits (5MB, image types) can be set in Dashboard: Storage → post-images → Settings.
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Storage policies: public read, authenticated upload/delete for post-images
create policy "post_images_public_read"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "post_images_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images');

create policy "post_images_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images');
