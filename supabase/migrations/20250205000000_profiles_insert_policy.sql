-- Allow authenticated users to create their own profile row (가입 시 프로필 생성)
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);
