-- 관리자: 비즈니스 스팟라이트 삭제 가능
create policy "business_spotlight_delete_admin"
  on public.business_spotlight for delete
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or exists (select 1 from public.admin_users where user_id = auth.uid())
  );
