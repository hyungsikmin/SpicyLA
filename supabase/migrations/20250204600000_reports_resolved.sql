-- 신고 처리 완료 표시
alter table public.reports
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users on delete set null;

comment on column public.reports.resolved_at is '처리 완료 시각';
comment on column public.reports.resolved_by is '처리한 관리자 user_id';

-- 관리자: reports 업데이트 (처리 완료 표시)
create policy "reports_update_admin"
  on public.reports for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' or exists (select 1 from public.admin_users where user_id = auth.uid()));
