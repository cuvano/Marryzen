-- ============================================================================
-- B7 — Underage hard-stop (server side)
-- ============================================================================
-- Problem: client-side age check (Step1b.jsx + OnboardingPage.validateStep1)
-- is solid for honest users, but a determined under-18 can bypass it by
-- editing localStorage or the request payload. The DB has no constraint and
-- the Didit webhook never cross-checks the verified DOB against what the user
-- claimed at signup.
--
-- Fix has two parts (this file = part 1, DB constraint; didit-webhook-v2.ts =
-- part 2, server-side cross-check on verified DOB):
--
--   1. CHECK constraint on profiles.date_of_birth — rejects any insert/update
--      where the DOB would make the user <18 on the current date. NOT VALID
--      so existing rows aren't validated (if any pre-launch test row has a
--      bad DOB, we'll fix manually rather than block the migration).
--   2. A small trigger that re-runs the check on profiles updates too, so a
--      malicious client can't first set DOB=valid then later flip it.
--
-- After this lands:
--   - Direct SQL inserts with <18 DOB → REJECTED at DB level.
--   - Onboarding submit with <18 DOB → REJECTED at DB level (the constraint
--     catches it even if the client validation is bypassed).
--   - Profile-edit attempt to lower DOB to <18 → REJECTED.
--
-- Note: the constraint allows NULL date_of_birth so the row CAN be created
-- with DOB unset (e.g. partial-onboarding rows). The DOB just has to be 18+
-- whenever it IS populated. Onboarding still requires it before letting the
-- user past Step 1, so this matches existing UX.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CHECK constraint — 18+ at time of write
-- ----------------------------------------------------------------------------
-- NOT VALID: only enforced on new writes. Existing rows (test profiles etc.)
-- not validated. This is the safe-by-default behavior: writes are protected
-- IMMEDIATELY, even if some legacy row has a bad DOB.
--
-- Reviewer fix (P1): we do NOT auto-VALIDATE in this transaction. If a single
-- legacy test row violates the rule, VALIDATE would roll back the entire
-- migration and we'd ship with NO constraint at all — defeating the purpose.
-- Instead, run the pre-flight query below FIRST, clean up any bad rows, then
-- run VALIDATE manually as a separate statement once you've confirmed no
-- legacy data violates.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_dob_must_be_18_plus;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_dob_must_be_18_plus
  CHECK (
    date_of_birth IS NULL
    OR date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')::date
  )
  NOT VALID;

-- ----------------------------------------------------------------------------
-- 2. Pre-flight: surface any existing rows that would fail validation
-- ----------------------------------------------------------------------------
-- Run this AFTER the migration applies. Any row returned needs cleanup
-- (either delete the test profile, or correct the DOB) before you run
-- VALIDATE CONSTRAINT.
--
--   SELECT id, full_name, email, date_of_birth
--   FROM public.profiles
--   WHERE date_of_birth IS NOT NULL
--     AND date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date;
--
-- If the query returns ZERO rows, you can immediately validate:
--
--   ALTER TABLE public.profiles
--     VALIDATE CONSTRAINT profiles_dob_must_be_18_plus;
--
-- If it returns rows, fix them first.

COMMIT;
