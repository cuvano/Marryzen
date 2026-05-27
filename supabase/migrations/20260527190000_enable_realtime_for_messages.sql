-- Enable Supabase Realtime for the chat tables.
--
-- WHY THIS EXISTS
-- ---------------
-- ChatPage subscribes to postgres_changes on `public.messages` and
-- `public.message_reactions` via supabase-js realtime. For those
-- events to fire, the tables must be in the platform's
-- `supabase_realtime` publication. They were not, so messages only
-- appeared on the receiver's screen after a manual page refresh.
--
-- This migration adds both tables to the publication. The Supabase
-- platform manages the publication and replication slot; we only
-- need to register the tables we care about streaming.
--
-- Idempotent via IF NOT EXISTS guard (PG15+ supports this on ALTER
-- PUBLICATION; for older versions, the DO block falls back gracefully).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;
