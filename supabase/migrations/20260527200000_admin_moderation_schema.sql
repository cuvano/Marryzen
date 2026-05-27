-- Tier 1 admin investigation panel — schema additions.
--
-- Adds two columns each on user_reports and one on profiles to support
-- the new action types (warn / suspend / ban), plus an admin SELECT policy
-- on messages so the moderator can read the conversation under review.
--
-- BACKGROUND
-- ----------
-- The existing SafetyPanel only had Dismiss / Resolve / Resolve+Ban. This
-- migration extends to: Dismiss, Send Warning, Suspend (1/7/30 days),
-- Permanent Ban. The expanded set requires recording:
--   - action_taken    (warning_sent | suspended | banned | none-dismissed)
--   - suspended_until (when the suspension expires; nullable)
--
-- ON profiles we also add `suspended_until` so the login gate knows when
-- to auto-clear a time-limited suspension.
--
-- We do NOT add a CHECK constraint on action_taken — keeping it loose so
-- future actions (e.g., "shadow_ban") can be added without a migration.
--
-- pg_cron is not enabled on this project, so auto-unsuspend happens
-- lazily inside the login flow via a SECURITY DEFINER RPC. No background
-- job required.

BEGIN;

-- 1. user_reports — record what action the admin took
ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS action_taken TEXT,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

-- 2. profiles — when a suspension ends (NULL = no active suspension)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

-- 3. Admin SELECT policy on messages (read-only)
DROP POLICY IF EXISTS "Admins can view all messages for moderation" ON public.messages;
CREATE POLICY "Admins can view all messages for moderation"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 4. Also let admins read all conversations so the join lookup works
DROP POLICY IF EXISTS "Admins can view all conversations for moderation" ON public.conversations;
CREATE POLICY "Admins can view all conversations for moderation"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 5. SECURITY DEFINER auto-unsuspend RPC.
--    Users typically lack UPDATE permission on profiles.status (sensitive
--    moderation field). To self-heal a time-limited suspension on login
--    without granting that permission, we route through this function.
--    It ONLY clears the caller's own suspension AND only if it has
--    actually expired — no privilege escalation, no way to self-approve
--    an unexpired suspension.
CREATE OR REPLACE FUNCTION public.clear_expired_suspension()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID         := auth.uid();
  v_now    TIMESTAMPTZ  := NOW();
  v_status TEXT;
  v_until  TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT status, suspended_until INTO v_status, v_until
  FROM public.profiles WHERE id = v_uid;

  IF v_status = 'suspended'
     AND v_until IS NOT NULL
     AND v_until <= v_now
  THEN
    UPDATE public.profiles
    SET status = 'approved', suspended_until = NULL
    WHERE id = v_uid;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_expired_suspension() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_expired_suspension() TO authenticated;

COMMIT;
