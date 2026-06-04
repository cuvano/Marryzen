-- ============================================================================
-- ADMIN SELECT POLICIES — profiles + user_reports
-- ============================================================================
-- WHY:
--   /admin/dashboard count widgets (Total Users, New Signups 24h/7d, Pending
--   Review, Open Reports, ID Verification Pending) all return 0 on production
--   because the profiles and user_reports tables have no RLS policy that grants
--   admin/super_admin role broad SELECT access. The existing admin_moderation
--   migration added these policies for `messages` and `conversations` but
--   missed `profiles` and `user_reports`. AdminLayout sidebar badges have the
--   same bug — both call sites use the same `count: 'exact', head: true`
--   pattern and both fail silently to 0 under RLS row-filtering.
--
-- THIS MIGRATION ADDS:
--   1. profiles: "Admins can view all profiles for moderation"
--   2. user_reports: "Admins can view all reports for moderation"
--
-- Both policies use the existing public.is_admin() helper (already deployed in
-- 20260527200000_admin_moderation_schema.sql), so no new function is added.
--
-- BLAST RADIUS:
--   - Read-only. No UPDATE/DELETE/INSERT changes.
--   - Only widens what admin/super_admin users can SELECT. Non-admin users
--     are unaffected (their existing per-row policies still apply).
--   - is_admin() returns false unless the calling auth.uid() row in profiles
--     has role IN ('admin','super_admin'). Public/anon users see no change.
--
-- IDEMPOTENT: DROP IF EXISTS before CREATE on both policies.
-- ============================================================================

BEGIN;

-- 1. profiles — admin SELECT all rows
DROP POLICY IF EXISTS "Admins can view all profiles for moderation" ON public.profiles;
CREATE POLICY "Admins can view all profiles for moderation"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 2. user_reports — admin SELECT all rows
DROP POLICY IF EXISTS "Admins can view all reports for moderation" ON public.user_reports;
CREATE POLICY "Admins can view all reports for moderation"
  ON public.user_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION — paste into SQL editor as a separate query after running above.
-- Should return rows > 0 for both tables when run as the admin user.
-- ----------------------------------------------------------------------------
-- SELECT count(*) AS profile_count FROM public.profiles;
-- SELECT count(*) AS report_count  FROM public.user_reports;
-- SELECT count(*) AS pending_count FROM public.profiles WHERE status = 'pending_review';
-- SELECT count(*) AS id_verif_pending FROM public.profiles WHERE identity_verification_status = 'pending';
