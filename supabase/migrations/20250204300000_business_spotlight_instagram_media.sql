-- 인스타 주소, 미디어(이미지/동영상 1개) 추가
alter table public.business_spotlight
  add column if not exists instagram_url text,
  add column if not exists media_path text,
  add column if not exists media_type text;

comment on column public.business_spotlight.instagram_url is 'Instagram URL or handle';
comment on column public.business_spotlight.media_path is 'Storage path in business-spotlight bucket';
comment on column public.business_spotlight.media_type is 'image or video';

-- Storage bucket for business spotlight media (public read)
insert into storage.buckets (id, name, public)
values ('business-spotlight', 'business-spotlight', true)
on conflict (id) do nothing;

create policy "business_spotlight_public_read"
  on storage.objects for select
  using (bucket_id = 'business-spotlight');

create policy "business_spotlight_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'business-spotlight' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "business_spotlight_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'business-spotlight' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "business_spotlight_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'business-spotlight' and (storage.foldername(name))[1] = auth.uid()::text);
