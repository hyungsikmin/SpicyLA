-- Run this in Supabase Dashboard → SQL Editor if 글로벌 알림 for poll/procon votes doesn't fire.
-- Prefer: apply migrations (e.g. supabase db push) so 20250206600000_realtime_poll_procon_votes runs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_poll_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_poll_votes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_procon_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_procon_votes;
  END IF;
END $$;
