-- Fix RLS: post_media insert checks post ownership without being blocked by posts RLS.
-- ⚠️ Run 20250203200000_post_media_and_storage.sql FIRST if post_media table does not exist.
create or replace function public.post_owner_id(p_post_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select user_id from public.posts where id = p_post_id limit 1;
$$;

drop policy if exists "post_media_insert" on public.post_media;
create policy "post_media_insert"
  on public.post_media for insert
  to authenticated
  with check (auth.uid() = public.post_owner_id(post_id));

drop policy if exists "post_media_delete" on public.post_media;
create policy "post_media_delete"
  on public.post_media for delete
  to authenticated
  using (auth.uid() = public.post_owner_id(post_id));

-- Ensure storage policies exist for post-images (run if you created bucket manually)
drop policy if exists "post_images_public_read" on storage.objects;
drop policy if exists "post_images_authenticated_upload" on storage.objects;
drop policy if exists "post_images_authenticated_delete" on storage.objects;

create policy "post_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'post-images');

create policy "post_images_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images');

create policy "post_images_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images');
