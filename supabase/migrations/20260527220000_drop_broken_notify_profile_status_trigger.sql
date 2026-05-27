-- Drop the broken notify_profile_status trigger.
--
-- BACKGROUND
-- ----------
-- The trigger `trigger_notify_profile_status` on `public.profiles` fires AFTER
-- UPDATE and calls `public.notify_profile_status_change()`. That function tries
-- to INSERT INTO `public.notifications` and `public.rewards`, but neither table
-- exists in the schema. Every profile.status write therefore raises:
--
--   ERROR 42P01: relation "notifications" does not exist
--   CONTEXT: PL/pgSQL function public.notify_profile_status_change()
--
-- The whole transaction rolls back. This silently broke:
--   - The new `clear_expired_suspension()` RPC introduced in
--     20260527200000_admin_moderation_schema.sql (caller sees a non-true return
--     value, login is wrongly kept-blocked).
--   - Any other code path that runs `UPDATE profiles SET status = '...'`,
--     including admin manual approval and the Didit webhook approval flow.
--
-- The trigger has been broken since launch; this migration removes it so the
-- approval/moderation pipelines stop silently failing. The
-- `notify_profile_status_change()` function itself is *preserved* so it can be
-- re-attached cleanly once the missing `notifications` + `rewards` tables are
-- built (planned Tier 2 work on the notifications/referrals system).
--
-- Diagnosed during the Tier 1 admin investigation panel smoke tests
-- (Session 9, 2026-05-27): SafetyPanel's `Suspend 1d` action worked, but the
-- LoginPage's auto-clear RPC was getting blocked by this trigger and the user
-- couldn't log back in after the suspension window expired.

BEGIN;

DROP TRIGGER IF EXISTS trigger_notify_profile_status ON public.profiles;

COMMIT;

-- Verification (read-only — does NOT need to be committed):
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'public.profiles'::regclass
--     AND tgname = 'trigger_notify_profile_status';
-- Expected: 0 rows.
