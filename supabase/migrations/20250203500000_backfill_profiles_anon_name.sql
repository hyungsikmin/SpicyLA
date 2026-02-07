-- 1) Create profile rows for all auth users that don't have one (profiles was empty)
INSERT INTO public.profiles (user_id, anon_name, created_at)
SELECT id, '익명' || (1000 + rn::int), COALESCE(created_at, now())
FROM (
  SELECT u.id, u.created_at,
    row_number() OVER (ORDER BY u.created_at NULLS LAST, u.id) AS rn
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
) sub;

-- 2) Backfill anon_name for any existing profile rows that are null/empty
UPDATE public.profiles p
SET anon_name = '익명' || (1000 + sub.rn::int)
FROM (
  SELECT user_id, row_number() OVER (ORDER BY created_at NULLS LAST, user_id) AS rn
  FROM public.profiles
  WHERE anon_name IS NULL OR trim(anon_name) = ''
) sub
WHERE p.user_id = sub.user_id;
