-- 점메추: 마감 시간 지나면 추천 제출 불가 (RLS로 강제)

drop policy if exists "lunch_recommendations_insert" on public.lunch_recommendations;

create policy "lunch_recommendations_insert"
  on public.lunch_recommendations for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.lunch_rounds r
      where r.id = round_id
        and r.status = 'open'
        and r.deadline_at > now()
    )
  );

comment on policy "lunch_recommendations_insert" on public.lunch_recommendations is '라운드가 open이고 마감 전(deadline_at > now())일 때만 제출 가능';
