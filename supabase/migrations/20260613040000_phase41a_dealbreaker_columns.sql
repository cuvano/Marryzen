-- ============================================================================
-- Phase 41a — Deal-breaker hard filters (4 fields)
-- 2026-06-13 04:00
--
-- Board-approved companion to the Matchmaking v1.5 release (Phase 41).
-- Decision doc: C:\Marryzen\Matchmaking_v1.5_Decision_2026-06-13.md
--
-- What this migration does:
--   Adds 4 boolean columns to public.profiles, one per deal-breaker dimension.
--   All default false (opt-in only). NOT NULL with default so existing rows
--   pick up the false value automatically — no backfill needed.
--
-- Why exactly 4 fields:
--   - faith                : Brand wedge, highest-value filter
--   - marital_status       : Real divorced/widowed/never-married preference signal
--   - has_children         : Direct compatibility signal users want a hard NO option for
--   - relationship_goal    : Prevent "Marriage Within 1-2 Years" users from being
--                           matched with "Family-Supervised Courtship" users when
--                           that's a no-go
--
-- Deliberately NOT included: age (already tiered in scorer), distance (already
-- tiered), smoking/drinking (too granular — drift risk), education (T&S
-- exec flagged as discrimination-shaped product surface).
--
-- Idempotent: safe to re-run via `add column if not exists`.
-- ============================================================================

alter table public.profiles
  add column if not exists dealbreaker_faith              boolean not null default false,
  add column if not exists dealbreaker_marital_status     boolean not null default false,
  add column if not exists dealbreaker_has_children       boolean not null default false,
  add column if not exists dealbreaker_relationship_goal  boolean not null default false;

comment on column public.profiles.dealbreaker_faith is
  'Phase 41a (2026-06-13): when true, Discovery hides profiles whose religious_affiliation does not exactly match this user''s religious_affiliation. User-controlled opt-in. Default false.';

comment on column public.profiles.dealbreaker_marital_status is
  'Phase 41a (2026-06-13): when true, Discovery hides profiles whose marital_status does not exactly match this user''s marital_status. User-controlled opt-in. Default false.';

comment on column public.profiles.dealbreaker_has_children is
  'Phase 41a (2026-06-13): when true, Discovery hides profiles whose has_children does not exactly match this user''s has_children. User-controlled opt-in. Default false.';

comment on column public.profiles.dealbreaker_relationship_goal is
  'Phase 41a (2026-06-13): when true, Discovery hides profiles whose relationship_goal does not exactly match this user''s relationship_goal. User-controlled opt-in. Default false.';

-- Verify the migration landed cleanly
do $$
declare
  v_count int;
begin
  select count(*)
    into v_count
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'profiles'
     and column_name  in (
       'dealbreaker_faith',
       'dealbreaker_marital_status',
       'dealbreaker_has_children',
       'dealbreaker_relationship_goal'
     );
  if v_count = 4 then
    raise notice 'Phase 41a deal-breaker columns added successfully (4/4).';
  else
    raise warning 'Phase 41a expected 4 deal-breaker columns, found %.', v_count;
  end if;
end $$;
