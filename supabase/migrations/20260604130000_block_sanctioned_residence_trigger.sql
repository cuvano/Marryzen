-- ============================================================================
-- SERVER-SIDE GEOGRAPHIC ELIGIBILITY ENFORCEMENT
-- ============================================================================
-- WHY:
--   Marryzen blocks 21 countries at the frontend (Step1b.jsx dropdown filter
--   + OnboardingPage.validateStep1). A determined user can bypass the
--   frontend via DOM manipulation, direct Supabase JS calls, or a custom
--   HTTP client. This trigger is defense-in-depth: even if the frontend
--   block is bypassed, the database rejects any profile insert/update whose
--   location_country lands in the blocked list.
--
-- MIRROR REQUIRED:
--   This blocked_countries array MUST match the SANCTIONED_RESIDENCE export
--   in src/lib/sanctionedJurisdictions.js. When you change one, change both.
--   Lift conditions per BLOCKED_COUNTRIES.md.
--
-- DESIGN CHOICES:
--   - BEFORE INSERT OR UPDATE OF location_country — fires only when the
--     country column is being set or changed. Existing profiles with a
--     now-blocked country can still update other fields (bio, photos, etc.)
--     without the trigger firing. This implicitly handles the grandfather
--     case: profiles created before a country was added to the blocklist
--     keep functioning normally for non-country edits.
--   - RAISE EXCEPTION USING ERRCODE = 'check_violation' (23514) — supabase-js
--     surfaces this as a clean error the frontend can catch and display.
--   - The error message is user-friendly (gets surfaced to the client) and
--     points to the same mailto: that the dropdown helper text references.
--
-- ROLLBACK SAFETY:
--   - DROP TRIGGER IF EXISTS + CREATE TRIGGER = idempotent.
--   - CREATE OR REPLACE FUNCTION = idempotent.
--   - Pre-existing profiles whose location_country was already in the block
--     list at the time this trigger was deployed are NOT affected — the
--     trigger only fires on INSERT or UPDATE OF location_country, not on
--     pure-bio updates or session metadata changes.
--
-- TODO (queued, separate sprint):
--   - Universal DSAR endpoint at privacy@marryzen.com with 15-day SLA
--     (PIPL floor) — Legal exec recommendation
--   - Grandfathering policy doc (30-day notice → export → hard delete) —
--     T&S + Legal joint recommendation
--   - Server-side waitlist capture (blocked_country_waitlist table + RPC +
--     Resend double opt-in) — Growth + Legal joint recommendation
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._block_sanctioned_residence()
RETURNS TRIGGER AS $$
DECLARE
  -- Mirror of SANCTIONED_RESIDENCE in src/lib/sanctionedJurisdictions.js.
  -- 21 entries: 5 OFAC + 2 secondary-sanctions/localization + 14 rep-required.
  blocked TEXT[] := ARRAY[
    -- OFAC comprehensive sanctions
    'Cuba', 'Iran', 'North Korea', 'Syria', 'Venezuela',
    -- US/EU sanctions + data localization
    'Russia', 'Belarus',
    -- Data-protection rep required, not yet purchased
    'China', 'Türkiye', 'Brazil', 'Switzerland', 'Saudi Arabia',
    'United Arab Emirates', 'South Korea', 'Japan', 'India',
    'Kazakhstan', 'Indonesia', 'Vietnam', 'Qatar', 'Nigeria'
  ];
BEGIN
  IF NEW.location_country IS NOT NULL AND NEW.location_country = ANY(blocked) THEN
    RAISE EXCEPTION
      'Marryzen is growing carefully and isn''t yet available in %. Email admin@marryzen.com with your country and we''ll let you know the moment we arrive.',
      NEW.location_country
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public._block_sanctioned_residence() IS
  'Defense-in-depth: rejects profile inserts/updates that set location_country to a sanctioned jurisdiction. Mirror of SANCTIONED_RESIDENCE in src/lib/sanctionedJurisdictions.js. Lift conditions per C:\Marryzen\handoff\geo_block\BLOCKED_COUNTRIES.md.';

DROP TRIGGER IF EXISTS trg_block_sanctioned_residence ON public.profiles;
CREATE TRIGGER trg_block_sanctioned_residence
  BEFORE INSERT OR UPDATE OF location_country ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._block_sanctioned_residence();

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION — paste into SQL editor as a separate query after running.
-- Each should fail with the friendly error message + 23514 SQLSTATE.
-- ----------------------------------------------------------------------------
-- BEGIN;
-- INSERT INTO public.profiles (id, location_country) VALUES (gen_random_uuid(), 'China');
-- ROLLBACK;
--
-- BEGIN;
-- UPDATE public.profiles SET location_country = 'India' WHERE id = (SELECT id FROM public.profiles LIMIT 1);
-- ROLLBACK;
--
-- These should succeed (no error):
-- SELECT location_country FROM public.profiles WHERE location_country = ANY(ARRAY['Cuba','India','Türkiye']);
-- (returns rows if any grandfathered profiles exist — they keep their existing value)
