-- ============================================================================
-- B6 — Photo moderation audit tables
-- ============================================================================
-- Two tables:
--   1. photo_scans      — every scan (pass + flag + block) for forensics
--   2. csam_incidents   — separate, restricted access, mandatory-reporting
--
-- Why two tables: photo_scans is high-volume and broadly readable by admins.
-- csam_incidents has stricter RLS (super_admin only) and is the legal evidence
-- record for 18 U.S.C. § 2258A NCMEC reporting. Keep them separate so the
-- main audit log doesn't accidentally leak CSAM context to lower-tier admins.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. photo_scans — every scan written here, regardless of outcome
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.photo_scans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at      timestamptz NOT NULL DEFAULT now(),
  -- 'pass' = upload allowed, 'flag' = passed but borderline, 'block' = rejected
  decision        text NOT NULL CHECK (decision IN ('pass', 'flag', 'block', 'error')),
  -- Top class returned by Hive (e.g. 'yes_female_breast', 'yes_violence')
  primary_flag    text,
  -- Confidence of the primary flag (0-1)
  primary_score   numeric(5, 4),
  -- Full Hive response for forensics (jsonb so we can query into it later)
  hive_response   jsonb,
  -- Hive's own task id (for cross-reference if we need to ask their support)
  hive_task_id    text,
  -- Where in the app the photo came from: 'onboarding' | 'profile' | 'cover'
  upload_context  text,
  -- IP + UA at scan time for abuse pattern detection
  client_ip       text,
  user_agent      text
);

CREATE INDEX IF NOT EXISTS photo_scans_user_id_idx ON public.photo_scans (user_id);
CREATE INDEX IF NOT EXISTS photo_scans_scanned_at_idx ON public.photo_scans (scanned_at DESC);
CREATE INDEX IF NOT EXISTS photo_scans_decision_idx ON public.photo_scans (decision) WHERE decision IN ('block', 'flag');

ALTER TABLE public.photo_scans ENABLE ROW LEVEL SECURITY;

-- Admins (any role) can read scans; only the Edge Function (service role) writes.
DROP POLICY IF EXISTS "Admins read photo scans" ON public.photo_scans;
CREATE POLICY "Admins read photo scans"
  ON public.photo_scans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ----------------------------------------------------------------------------
-- 2. csam_incidents — restricted to super_admin only, evidence record for NCMEC
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.csam_incidents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at       timestamptz NOT NULL DEFAULT now(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  user_email        text,
  user_ip           text,
  user_agent        text,
  -- Reference to the matching photo_scans row for full context
  photo_scan_id     uuid REFERENCES public.photo_scans(id) ON DELETE RESTRICT,
  -- 'hash_match' = known CSAM via PhotoDNA, 'ml_detection' = Hive ML, 'manual_report' = admin review
  detection_method  text NOT NULL CHECK (detection_method IN ('hash_match', 'ml_detection', 'manual_report')),
  detection_score   numeric(5, 4),
  -- Status of the NCMEC report (US law requires reporting within reasonable time)
  ncmec_report_status text NOT NULL DEFAULT 'pending'
    CHECK (ncmec_report_status IN ('pending', 'filed', 'not_applicable', 'investigating')),
  ncmec_report_id   text,
  ncmec_filed_at    timestamptz,
  -- Action taken on the user account (auto-ban is the default)
  account_action    text NOT NULL DEFAULT 'banned'
    CHECK (account_action IN ('banned', 'suspended', 'under_review', 'no_action')),
  notes             text,
  -- Who reviewed/handled this incident (super_admin user id)
  reviewed_by       uuid REFERENCES auth.users(id),
  reviewed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS csam_incidents_detected_at_idx ON public.csam_incidents (detected_at DESC);
CREATE INDEX IF NOT EXISTS csam_incidents_user_id_idx ON public.csam_incidents (user_id);
CREATE INDEX IF NOT EXISTS csam_incidents_status_idx ON public.csam_incidents (ncmec_report_status)
  WHERE ncmec_report_status = 'pending';

ALTER TABLE public.csam_incidents ENABLE ROW LEVEL SECURITY;

-- ONLY super_admins can read CSAM incidents. Regular admins do not need access.
DROP POLICY IF EXISTS "Super admins read CSAM incidents" ON public.csam_incidents;
CREATE POLICY "Super admins read CSAM incidents"
  ON public.csam_incidents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Super admins can also update (to file NCMEC reports, add notes, etc.)
DROP POLICY IF EXISTS "Super admins update CSAM incidents" ON public.csam_incidents;
CREATE POLICY "Super admins update CSAM incidents"
  ON public.csam_incidents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
--   -- Tables exist?
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN ('photo_scans', 'csam_incidents');
--
--   -- Policies installed?
--   SELECT polname FROM pg_policy
--   WHERE polrelid IN ('public.photo_scans'::regclass, 'public.csam_incidents'::regclass);
-- ============================================================================
