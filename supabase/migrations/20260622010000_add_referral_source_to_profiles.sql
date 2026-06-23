-- 20260622010000_add_referral_source_to_profiles.sql
--
-- Adds a column to record the attribution source captured at signup so we can
-- attribute the first N members to specific organic/paid channels (Instagram,
-- TikTok, podcast sponsorship, mosque referral, etc.) without depending on
-- a third-party analytics tool to retain the data.
--
-- Populated from src/lib/utm.js (formatReferralSource()) at the moment the
-- user's profile row is inserted in OnboardingPage. Format is a slash-
-- separated string "source/medium/campaign" — e.g. "instagram/bio/organic",
-- "podcast/sponsorship/halfdeen", or null when the user arrived direct.
--
-- Privacy: not personal data of itself; it's the channel that introduced the
-- user, equivalent to the "How did you hear about us?" question on a signup
-- form. Marryzen does not on-share this to any vendor; visible only in the
-- admin console. Already covered by ROPA §3.1 "Account creation" processing
-- activity — no new processing activity introduced.
--
-- Backfill: this column is nullable and has no default. Existing rows remain
-- NULL, indicating "unknown source / pre-attribution-launch member."

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_source text;

COMMENT ON COLUMN public.profiles.referral_source IS
  'UTM attribution captured at signup, format "source/medium/campaign" (e.g. "instagram/bio/organic"). Null = direct or pre-attribution-launch. Populated from src/lib/utm.js cookie at the OnboardingPage profile-insert step.';

-- No CHECK constraint — the column is free-form to accommodate any future
-- channel taxonomy without requiring a migration. Length is implicitly capped
-- by the writer at 200 chars (see formatReferralSource() in src/lib/utm.js).
