-- ============================================================================
-- B14 - Auto-renewal compliant promo flow
-- ============================================================================
-- Adds:
--   1. Columns on profiles:
--        - premium_consent_acknowledged_at: when user ticked the "I understand
--          auto-renewal" checkbox at purchase. NULL means they haven't
--          consented under the new flow yet (legacy users get migrated lazily).
--        - founding_member: boolean, set TRUE by trigger when is_verified
--          flips true AND fewer than 500 founding members exist yet.
--        - renewal_reminders_sent: jsonb, tracks which reminder emails went
--          out (keys like "2026-08-15_d7", "2026-08-15_d1") to ensure
--          idempotency in case the cron fires twice.
--   2. Trigger: assign_founding_member_status() — on UPDATE of is_verified
--      from false -> true, atomically check the global count and set
--      founding_member=true if cap not yet reached. Row-level lock prevents
--      races at the 499/500 boundary.
--   3. RPC: get_founding_member_count() — returns the current count of
--      founding_member=true users. Called from LandingPage to display
--      "X of 500 spots remaining". SECURITY DEFINER so anon callers can read
--      the count without needing direct profile SELECT access.
--   4. pg_cron job: daily 09:00 UTC, calls the send-renewal-reminder Edge
--      Function via pg_net. The Edge Function then scans profiles whose
--      premium period ends in 7d or 1d and sends the appropriate email.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_consent_acknowledged_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_member boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS renewal_reminders_sent jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Index for the cron scan + admin queue queries.
CREATE INDEX IF NOT EXISTS profiles_premium_expiry_idx
  ON public.profiles (premium_expires_at)
  WHERE is_premium = true AND premium_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_founding_member_idx
  ON public.profiles (founding_member) WHERE founding_member = true;

-- ----------------------------------------------------------------------------
-- 2. Trigger: assign founding member status atomically
-- ----------------------------------------------------------------------------
-- The 500 cap. Hard-coded per the Founding Member Terms page (B15).
-- Change requires migration + new ROADMAP note.
CREATE OR REPLACE FUNCTION public.assign_founding_member_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap         constant integer := 500;
  v_count       integer;
BEGIN
  -- Only fire on is_verified flipping from false/null -> true
  IF NEW.is_verified IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;
  IF OLD.is_verified IS true THEN
    -- Already verified before; no flip; no founding-member work
    RETURN NEW;
  END IF;
  -- Already assigned? Don't double-assign.
  IF NEW.founding_member IS true THEN
    RETURN NEW;
  END IF;

  -- Lock the count to prevent races at the 499/500 boundary.
  -- Two simultaneous verifications could both see count=499 and both grant.
  -- Use a serializable advisory lock on a constant key.
  PERFORM pg_advisory_xact_lock(hashtext('founding_member_assign'));

  SELECT count(*) INTO v_count FROM public.profiles WHERE founding_member = true;
  IF v_count < v_cap THEN
    NEW.founding_member := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_founding_member ON public.profiles;
CREATE TRIGGER trg_assign_founding_member
  BEFORE UPDATE OF is_verified ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_founding_member_status();

-- ----------------------------------------------------------------------------
-- 3. RPC: get_founding_member_count
-- ----------------------------------------------------------------------------
-- Public-readable count. Returns { current, cap, remaining }.
CREATE OR REPLACE FUNCTION public.get_founding_member_count()
RETURNS TABLE (
  current_count integer,
  cap_total     integer,
  remaining     integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap   constant integer := 500;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.profiles WHERE founding_member = true;
  current_count := COALESCE(v_count, 0);
  cap_total := v_cap;
  remaining := GREATEST(0, v_cap - COALESCE(v_count, 0));
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_founding_member_count() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. pg_cron daily renewal reminder
-- ----------------------------------------------------------------------------
-- This requires pg_net (for http_post). Already enabled by Supabase by default
-- on most projects. If you get "function net.http_post does not exist", run:
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- Auth: the send-renewal-reminder Edge Function is called by pg_cron using
-- the service role key from Vault. The Edge Function uses
-- SUPABASE_SERVICE_ROLE_KEY (auto-injected) to read/write profiles. JWT
-- verification can be left ON (default) since a service-role JWT passes.

-- P1-1 fix: hard fail if Vault secret is missing, so the install error is
-- LOUD instead of a silent daily 401.
DO $preflight$
BEGIN
  IF (SELECT count(*) FROM vault.decrypted_secrets WHERE name = 'service_role_key') = 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Vault secret service_role_key is not set. Open Supabase Dashboard -> Settings -> Vault, create a secret named service_role_key whose value is your project service role key (from Settings -> API), then re-run this migration.';
  END IF;
END
$preflight$;

-- P0-2 fix: previous DO block used invalid PL/pgSQL syntax
-- (v_anon_key := decrypted_secret FROM ...) which fails to parse.
-- The dead-code DECLARE is removed; we just unschedule (guarded) + schedule.
DO $sched$
BEGIN
  -- cron.unschedule raises if the job does not exist. Guard with EXCEPTION.
  BEGIN
    PERFORM cron.unschedule('send-renewal-reminders-daily');
  EXCEPTION WHEN OTHERS THEN
    -- Job didn't exist yet. First install. Continue.
    NULL;
  END;

  PERFORM cron.schedule(
    'send-renewal-reminders-daily',
    '0 9 * * *',  -- 09:00 UTC daily
    'SELECT net.http_post(' ||
      'url := ''https://adufstvmmzpqdcmpinqd.supabase.co/functions/v1/send-renewal-reminder'',' ||
      'headers := jsonb_build_object(' ||
        '''Content-Type'', ''application/json'',' ||
        '''Authorization'', ''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''service_role_key'' LIMIT 1)' ||
      '),' ||
      'body := ''{}''::jsonb' ||
    ');'
  );
END
$sched$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION ONE-TIME SETUP (do this in Supabase Dashboard)
-- ============================================================================
-- 1. Settings -> Vault -> add a secret:
--      Name:  service_role_key
--      Value: (paste your project service role key from Settings -> API)
--    This is what the daily cron uses to call the Edge Function.
-- 2. Edge Functions -> send-renewal-reminder -> Settings -> turn OFF
--    "Verify JWT with legacy secret" so the cron can invoke it.
-- ============================================================================

-- ============================================================================
-- VERIFICATION
-- ============================================================================
--   -- Cron job scheduled?
--   SELECT jobname, schedule, command FROM cron.job
--   WHERE jobname = 'send-renewal-reminders-daily';
--
--   -- Trigger installed?
--   
