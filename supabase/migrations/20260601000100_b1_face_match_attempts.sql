-- ============================================================================
-- B1 — face_match_attempts audit table
-- ============================================================================
-- Every face-similarity comparison between a Didit selfie and a profile photo
-- writes a row here. Used for:
--   1. Admin review of borderline scores (0.4-0.7 range)
--   2. Appeals — user claims false-negative, admin reviews + can override
--   3. Forensics — if a verified account turns out to be fraud, we can trace
--      back to the exact match score + photos involved
--   4. ML observability — over time, see the distribution of scores to tune
--      thresholds
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.face_match_attempts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at           timestamptz NOT NULL DEFAULT now(),
  -- URLs of the two images we compared. selfie comes from Didit, photo from
  -- profiles.photos[0] at the moment of the check.
  selfie_url             text,
  profile_photo_url      text,
  -- Sightengine returns a similarity score 0..1 (1 = same person).
  similarity_score       numeric(5, 4),
  -- 'match' = score >= MATCH_THRESHOLD, 'mismatch' = score < MISMATCH_THRESHOLD,
  -- 'review' = score between (borderline), 'error' = compare failed
  decision               text NOT NULL CHECK (decision IN ('match', 'mismatch', 'review', 'error')),
  -- Whether the verified badge was granted as a result of this attempt
  granted_verified       boolean NOT NULL DEFAULT false,
  -- Full Sightengine response for forensics
  vendor_response        jsonb,
  -- Sightengine request id from their response (for cross-reference)
  vendor_request_id      text,
  -- Admin who reviewed (if any)
  reviewed_by            uuid REFERENCES auth.users(id),
  reviewed_at            timestamptz,
  admin_decision         text CHECK (admin_decision IN ('confirmed_match', 'confirmed_mismatch', 'inconclusive')),
  admin_notes            text
);

CREATE INDEX IF NOT EXISTS face_match_attempts_user_id_idx
  ON public.face_match_attempts (user_id);
CREATE INDEX IF NOT EXISTS face_match_attempts_decision_idx
  ON public.face_match_attempts (decision) WHERE decision IN ('mismatch', 'review');
CREATE INDEX IF NOT EXISTS face_match_attempts_attempted_at_idx
  ON public.face_match_attempts (attempted_at DESC);

ALTER TABLE public.face_match_attempts ENABLE ROW LEVEL SECURITY;

-- Admins can read all attempts (for review queue + appeals)
DROP POLICY IF EXISTS "Admins read face match attempts" ON public.face_match_attempts;
CREATE POLICY "Admins read face match attempts"
  ON public.face_match_attempts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can update (to record admin_decision + admin_notes after review)
DROP POLICY IF EXISTS "Admins update face match attempts" ON public.face_match_attempts;
CREATE POLICY "Admins update face match attempts"
  ON public.face_match_attempts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- The Edge Function writes via service_role which bypasses RLS, so no INSERT
-- policy needed for the writer path.

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
--   SELECT * FROM public.face_match_attempts ORDER BY attempted_at DESC LIMIT 10;
--   SELECT decision, count(*) FROM public.face_match_attempts GROUP BY decision;
-- ============================================================================
