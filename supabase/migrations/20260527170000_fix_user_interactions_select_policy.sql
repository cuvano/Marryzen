-- Fix: user_interactions SELECT policy was too restrictive.
--
-- Before:
--   USING (auth.uid() = user_id)
--   → Users could ONLY see interactions where they were the LIKER (the actor).
--     They could not see incoming likes from other users.
--
-- Consequences in the live app:
--   1. "Likes You" tab in MatchesPage permanently showed 0 for ALL users
--      (the query `SELECT * FROM user_interactions WHERE target_user_id = me
--       AND interaction_type = 'like'` is RLS-blocked because RLS requires
--      user_id = me).
--   2. Mutual-match computation in MatchesPage.fetchData never fired:
--      the `likesToMe` Promise.all subquery returned empty for everyone, so
--      mutualIds was always empty, so no conversation backfills happened.
--   3. No mutual likes ever produced a "match" or auto-created conversation,
--      effectively breaking the entire match → chat flow across production.
--   4. (Bonus) DiscoveryPage swipe-time mutual check was also silently broken.
--
-- After:
--   USING (auth.uid() = user_id
--          OR (auth.uid() = target_user_id AND interaction_type = 'like'))
--   → Users can still see their own outgoing interactions (likes AND passes).
--   → Users can ALSO see incoming LIKES (only — passes are kept private to
--     the actor, since exposing who passed on you is bad UX and could enable
--     harassment / hurt feelings without recourse).
--
-- This is the minimal change that restores match functionality without
-- leaking pass history.

-- Wrapped in a transaction so the DROP + CREATE land atomically (no
-- sub-ms window where the table has no SELECT policy at all).
BEGIN;

DROP POLICY IF EXISTS "Users view own interactions" ON public.user_interactions;

CREATE POLICY "Users view own + incoming likes"
  ON public.user_interactions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.uid() = target_user_id AND interaction_type = 'like')
  );

COMMIT;
