-- Realtime: 투표/찬반 알림을 위해 테이블을 publication에 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_poll_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_poll_votes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_procon_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_procon_votes;
  END IF;
END $$;
