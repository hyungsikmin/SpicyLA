-- Welcome flow: T&C and onboarding completion timestamps
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.terms_accepted_at is 'When the user accepted the platform T&C (first-time welcome flow)';
comment on column public.profiles.onboarding_completed_at is 'When the user completed the onboarding carousel (first-time welcome flow)';
