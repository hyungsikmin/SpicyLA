-- 관리자 추가 (Supabase Dashboard → SQL Editor에서 실행)
-- admin_users 테이블에 넣으면 해당 유저가 관리자로 인식됩니다. 로그인만 하면 됨.

-- 방법 1: 이메일로 추가 (첫 관리자거나 이미 관리자인 계정으로 실행)
INSERT INTO public.admin_users (user_id)
SELECT id FROM auth.users WHERE email = '여기에@이메일.com'
ON CONFLICT (user_id) DO NOTHING;

-- 방법 2: 유저 ID로 추가 (Authentication → Users에서 복사)
-- INSERT INTO public.admin_users (user_id)
-- VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
-- ON CONFLICT (user_id) DO NOTHING;

-- 확인: 관리자 목록 보기
-- SELECT au.user_id, u.email, au.created_at
-- FROM public.admin_users au
-- JOIN auth.users u ON u.id = au.user_id;
