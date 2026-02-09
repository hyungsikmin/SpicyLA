-- 시드 계정 목록 (관리자 페이지에서 생성한 계정만 조회용)
-- 서버에서 service_role로만 접근하므로 RLS 미적용
create table if not exists public.seed_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);

comment on table public.seed_accounts is '시드/UGC 런칭용으로 관리자가 생성한 계정 목록. /admin/seed-accounts에서만 사용.';
