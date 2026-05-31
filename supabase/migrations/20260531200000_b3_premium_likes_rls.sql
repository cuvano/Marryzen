-- ============================================================================
-- B3 — Premium-likes server-side gate
-- ============================================================================
-- Problem: UI hides who-liked-you behind a blur for non-premium users, but the
-- underlying row was visible in DevTools Network tab. Anyone with browser
-- inspector could read liker user_ids without paying. Chargeback risk + a
-- "Marryzen lied" Reddit thread waiting to happen.
--
-- Fix has two parts:
--   1. RLS TIGHTENING — direct SELECTs on incoming likes now require either
--      (a) the viewer be the liker themselves (outgoing), or
--      (b) a mutual match exists (so both halves of the match are visible
--          for chat/match flows).
--      Non-premium users querying directly see ZERO non-mutual incoming likes.
--   2. TWO NEW RPCs (SECURITY DEFINER) — server-trusted paths that the UI
--     uses to show the Likes-You tab + the Profile Interest count:
--        - get_received_likes(limit, offset)
--          Returns rows with liker_id ONLY when viewer is premium OR there's
--          a mutual match. Otherwise liker_id=NULL + is_locked=true. Includes
--          basic profile metadata (name/photos) for premium so UI can render
--          a profile card in one round trip.
--        - get_received_likes_count()
--          Returns total inbound-like count (premium-agnostic — the count is
--          fine to show; only liker identity is gated).
--
-- Why this doesn't break existing flows:
--   - MatchesPage fetchData line 119 (mutual calc): the query already filters
--     to mutual rows downstream — RLS just does that filtering server-side
--     now. Same result.
--   - DiscoveryPage swipe-time mutual check: after the user's own LIKE row is
--     inserted (line 498), the mutual EXISTS subquery sees that row, so the
--     reverse-like row is visible. Same as before.
--   - DashboardPage Profile Interest count: switched to the new RPC, returns
--     accurate count regardless of premium tier.
--   - MatchesPage Likes-You tab: switched to the new RPC, returns redacted
--     rows for non-premium with is_locked=true so the UI can render the
--     blurred-card state honestly (instead of pretending to blur something
--     it already sent in the clear).
--
-- Failure mode if this migration runs but the client patches don't ship:
--   - Likes-You tab will be EMPTY for non-premium (RLS blocks non-mutual rows).
--   - Profile Interest count will show only mutual likes (under-count).
--   - Both degrade gracefully; no errors, no broken matches.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. RPC: get_received_likes(limit, offset)
-- ----------------------------------------------------------------------------
-- Returns incoming likes WITH per-row redaction based on viewer's premium
-- tier. SECURITY DEFINER so it can read past RLS to compute mutual-match
-- status + return data the viewer is entitled to see.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_received_likes(
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  liker_id        uuid,
  is_locked       boolean,
  is_mutual       boolean,
  liked_at        timestamptz,
  full_name       text,
  photos          text[],
  location_city   text,
  location_country text,
  date_of_birth   date,
  is_premium      boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id          uuid := auth.uid();
  viewer_is_premium  boolean;
BEGIN
  IF viewer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'PT401';
  END IF;

  -- Clamp inputs defensively.
  IF p_limit  IS NULL OR p_limit  < 1 OR p_limit  > 200 THEN p_limit  := 50; END IF;
  IF p_offset IS NULL OR p_offset < 0                  THEN p_offset := 0;  END IF;

  SELECT COALESCE(p.is_premium, false)
    INTO viewer_is_premium
    FROM public.profiles p
   WHERE p.id = viewer_id;

  RETURN QUERY
  WITH incoming AS (
    SELECT
      ui.user_id    AS liker_user_id,
      ui.created_at,
      EXISTS (
        SELECT 1
          FROM public.user_interactions m
         WHERE m.user_id          = viewer_id
           AND m.target_user_id   = ui.user_id
           AND m.interaction_type = 'like'
      ) AS mutual
      FROM public.user_interactions ui
     WHERE ui.target_user_id   = viewer_id
       AND ui.interaction_type = 'like'
     ORDER BY ui.created_at DESC
     LIMIT  p_limit
     OFFSET p_offset
  )
  SELECT
    -- Redaction: hide liker identity unless viewer is premium OR it's mutual.
    CASE WHEN viewer_is_premium OR i.mutual THEN i.liker_user_id ELSE NULL END AS liker_id,
    NOT (viewer_is_premium OR i.mutual)                                       AS is_locked,
    i.mutual                                                                  AS is_mutual,
    i.created_at                                                              AS liked_at,
    -- Profile fields only populated when viewer can see the identity.
    CASE WHEN viewer_is_premium OR i.mutual THEN p.full_name        ELSE NULL END AS full_name,
    CASE WHEN viewer_is_premium OR i.mutual THEN p.photos           ELSE NULL END AS photos,
    CASE WHEN viewer_is_premium OR i.mutual THEN p.location_city    ELSE NULL END AS location_city,
    CASE WHEN viewer_is_premium OR i.mutual THEN p.location_country ELSE NULL END AS location_country,
    CASE WHEN viewer_is_premium OR i.mutual THEN p.date_of_birth    ELSE NULL END AS date_of_birth,
    CASE WHEN viewer_is_premium OR i.mutual THEN p.is_premium       ELSE NULL END AS is_premium
    FROM incoming i
    LEFT JOIN public.profiles p ON p.id = i.liker_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_received_likes(integer, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. RPC: get_received_likes_count()
-- ----------------------------------------------------------------------------
-- Returns total inbound-like count. The count itself isn't gated (the UI
-- shows it to non-premium too, as the "tease" — "8 people liked you, upgrade
-- to see who"). Only liker identity is premium-gated. SECURITY DEFINER so it
-- can count past the tightened RLS.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_received_likes_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id uuid := auth.uid();
  total     integer;
BEGIN
  IF viewer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'PT401';
  END IF;

  SELECT COUNT(*)::integer
    INTO total
    FROM public.user_interactions
   WHERE target_user_id   = viewer_id
     AND interaction_type = 'like';

  RETURN COALESCE(total, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_received_likes_count() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Tighten RLS on user_interactions SELECT
-- ----------------------------------------------------------------------------
-- BEFORE (from 20260527170000_fix_user_interactions_select_policy.sql):
--   USING (auth.uid() = user_id
--          OR (auth.uid() = target_user_id AND interaction_type = 'like'))
--   → Anyone could SELECT all incoming likes — the leak.
--
-- AFTER:
--   USING (auth.uid() = user_id
--          OR (auth.uid() = target_user_id
--              AND interaction_type = 'like'
--              AND EXISTS (mutual reverse like)))
--   → Direct SELECTs on incoming likes only return MUTUAL rows. Non-mutual
--     incoming likes are visible exclusively via get_received_likes() RPC,
--     which applies premium-tier redaction.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own + incoming likes" ON public.user_interactions;

CREATE POLICY "Users view own + mutual incoming likes"
  ON public.user_interactions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      auth.uid() = target_user_id
      AND interaction_type = 'like'
      AND EXISTS (
        SELECT 1
          FROM public.user_interactions reverse_like
         WHERE reverse_like.user_id          = auth.uid()
           AND reverse_like.target_user_id   = user_interactions.user_id
           AND reverse_like.interaction_type = 'like'
      )
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration to confirm)
-- ============================================================================
-- 1. Both RPCs exist:
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname IN ('get_received_likes','get_received_likes_count');
--
-- 2. Policy is the tightened version:
--    SELECT polname, pg_get_expr(polqual, polrelid)
--    FROM pg_policy WHERE polrelid = 'public.user_interactions'::regclass
--    AND polcmd = 'r';
--
-- 3. As a non-premium test user, this should return only mutual rows:
--    SELECT count(*) FROM public.user_interactions
--    WHERE target_user_id = auth.uid() AND interaction_type = 'like';
--    -- vs. the RPC, which returns all incoming with redaction:
--    SELECT * FROM public.get_received_likes(100, 0);
-- ============================================================================
