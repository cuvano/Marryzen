-- ============================================================================
-- HOTFIX — user_interactions SELECT policy: infinite recursion
-- ============================================================================
-- Bug: B3 (b3_premium_likes_rls.sql, 2026-05-29) introduced an EXISTS
-- subquery inside the SELECT policy USING clause that references the SAME
-- table the policy is on:
--
--   CREATE POLICY "Users view own + mutual incoming likes"
--     ON public.user_interactions
--     FOR SELECT TO authenticated
--     USING (
--       auth.uid() = user_id
--       OR (
--         auth.uid() = target_user_id
--         AND interaction_type = 'like'
--         AND EXISTS (
--           SELECT 1 FROM public.user_interactions reverse_like  ← recursion
--           WHERE reverse_like.user_id = auth.uid()
--             AND reverse_like.target_user_id = user_interactions.user_id
--             AND reverse_like.interaction_type = 'like'
--         )
--       )
--     );
--
-- Postgres applies the same RLS policy to the inner SELECT, which re-evaluates
-- the EXISTS, which queries the table again → infinite recursion error.
--
-- Repro: any SELECT or INSERT-RETURNING on user_interactions for a non-admin
-- user fails with "infinite recursion detected in policy for relation
-- 'user_interactions'". This breaks the entire Like flow on production.
--
-- Fix: extract the recursive check into a SECURITY DEFINER helper function.
-- SECURITY DEFINER functions run with the function owner's privileges and
-- bypass RLS on the inner query, breaking the recursion loop. This is the
-- canonical Postgres pattern for self-referential RLS.
--
-- Preserves B3 security guarantee: non-premium direct SELECTs still see only
-- mutual incoming likes. The premium gating still happens in the
-- get_received_likes RPC.
-- ===========================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER helper: does the current user have a mutual like with
--    the other user? Bypasses RLS on the inner query (no recursion).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._has_mutual_like(other_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_interactions
     WHERE user_id          = auth.uid()
       AND target_user_id   = other_user_id
       AND interaction_type = 'like'
  );
$$;

GRANT EXECUTE ON FUNCTION public._has_mutual_like(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Replace the broken policy. Same semantic guarantee, no recursion.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own + mutual incoming likes" ON public.user_interactions;

CREATE POLICY "Users view own + mutual incoming likes"
  ON public.user_interactions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      auth.uid() = target_user_id
      AND interaction_type = 'like'
      AND public._has_mutual_like(user_interactions.user_id)
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION (run after applying)
-- ============================================================================
-- 1. Helper exists + correct security level:
--    SELECT proname, prosecdef, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname = '_has_mutual_like';
--    -- Expect: 1 row, prosecdef = t, args = "other_user_id uuid"
--
-- 2. Policy installed:
--    SELECT polname, pg_get_expr(polqual, polrelid)
--    FROM pg_policy
--    WHERE polrelid = 'public.user_interactions'::regclass AND polcmd = 'r';
--    -- Expect: USING contains "_has_mutual_like(user_id)" not "EXISTS"
--
-- 3. As a logged-in test user, try to read user_interactions — should NOT
--    error with "infinite recursion":
--    SELECT count(*) FROM public.user_interactions LIMIT 1;
--
-- 4. End-to-end: log in to marryzen.com as a real user, click Like on a
--    Discovery card — no error toast.
-- ============================================================================
