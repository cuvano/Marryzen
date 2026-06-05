-- ============================================================================
-- ADD CITY COLUMNS TO PROFILES — supports city dropdown + distance matching
-- ============================================================================
-- WHY:
--   Step1b currently captures location_city as free-text. This causes match
--   algorithm misses ("São Paulo" ≠ "Sao Paulo") and bad UX. The new city
--   dropdown writes a normalized city ID + denormalized lat/lng so the
--   existing Haversine distance scoring in src/lib/matchmaking.js (lines
--   189-206) can fire on real coordinates instead of falling back to
--   string-equality city matching.
--
-- WHAT THIS MIGRATION ADDS:
--   - city_geoname_id   bigint    — GeoNames stable city ID (source of truth)
--   - latitude          double precision  — city lat (denormalized for fast Discovery query)
--   - longitude         double precision  — city lng (denormalized)
--   - city_unverified   boolean DEFAULT false — true when user typed a city
--     not in the dataset (free-text fallback for small towns)
--
-- NOTE: latitude/longitude may already exist on profiles (matchmaking.js
-- references them at line 189 — `currentUser.latitude && currentUser.longitude`).
-- We add them defensively with IF NOT EXISTS so this migration is safe to
-- run regardless of prior state. The existing location_city (text) column is
-- KEPT and continues to be populated alongside the new columns — backward
-- compat for DiscoveryPage line 305 (`query.ilike('location_city', ...)`).
--
-- BACKFILL POLICY:
--   Pre-launch: 2 profiles in DB (Omer + Sandra). No automated backfill —
--   these can be re-set manually via /profile edit once the new component
--   ships. Post-launch any profile that signed up before this migration will
--   simply have NULL city_geoname_id / latitude / longitude until the user
--   re-edits, which is a no-op for the matching algorithm (falls back to
--   city-name equality, same as today).
--
-- ROLLBACK SAFETY:
--   - All ADD COLUMN use IF NOT EXISTS (idempotent).
--   - No data migration / no destructive changes.
--   - Drops are not provided here; if rollback needed, run:
--       ALTER TABLE public.profiles
--         DROP COLUMN IF EXISTS city_geoname_id,
--         DROP COLUMN IF EXISTS city_unverified;
--     (Do NOT drop latitude/longitude — they may have been populated by
--     other means before this migration ran.)
-- ============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city_geoname_id bigint,
  ADD COLUMN IF NOT EXISTS latitude        double precision,
  ADD COLUMN IF NOT EXISTS longitude       double precision,
  ADD COLUMN IF NOT EXISTS city_unverified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.city_geoname_id IS
  'GeoNames stable city ID. NULL when city_unverified=true (free-text fallback for towns not in cities.json dataset).';

COMMENT ON COLUMN public.profiles.latitude IS
  'Denormalized city latitude (degrees). Used by src/lib/matchmaking.js Haversine distance scoring. NULL falls back to city-name equality.';

COMMENT ON COLUMN public.profiles.longitude IS
  'Denormalized city longitude (degrees). See latitude for usage.';

COMMENT ON COLUMN public.profiles.city_unverified IS
  'TRUE when the user typed a city that was not found in the GeoNames dataset. Admin review queue can promote unverified entries to the canonical dataset.';

-- Index for distance-ranked Discovery queries (future: WHERE lat IS NOT NULL AND lng IS NOT NULL ORDER BY distance)
CREATE INDEX IF NOT EXISTS profiles_geo_idx
  ON public.profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for admin review of unverified city entries
CREATE INDEX IF NOT EXISTS profiles_city_unverified_idx
  ON public.profiles (created_at DESC)
  WHERE city_unverified = true;

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION — run after migration applies
-- ----------------------------------------------------------------------------
-- \d public.profiles  -- should show city_geoname_id, latitude, longitude, city_unverified
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'profiles'
--     AND column_name IN ('city_geoname_id','latitude','longitude','city_unverified','location_city');
