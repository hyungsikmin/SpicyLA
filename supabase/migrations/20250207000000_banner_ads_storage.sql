-- Storage bucket for banner ad images (관리자 배너 광고 업로드)
insert into storage.buckets (id, name, public)
values ('banner-ads', 'banner-ads', true)
on conflict (id) do nothing;

create policy "banner_ads_public_read"
  on storage.objects for select
  using (bucket_id = 'banner-ads');

create policy "banner_ads_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'banner-ads');

create policy "banner_ads_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'banner-ads');

create policy "banner_ads_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'banner-ads');
