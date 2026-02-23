-- 시드 계정용 AI 페르소나 (LA 20-30대 남/여, 자연스러운 말투)
alter table public.seed_accounts
  add column if not exists persona_prompt text;

comment on column public.seed_accounts.persona_prompt is 'AI 에이전트용 페르소나. LA 20-30대, 자연스러운 말투로 글/댓글 생성 시 시스템 프롬프트에 사용.';
