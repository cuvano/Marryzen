-- ============================================================================
-- Phase 41e — Age preference columns for refinement 1b
-- 2026-06-13 06:00
--
-- Board-approved (3-agent consult unanimous on 1b).
-- Decision basis: avoid UK Equality Act §13 risk of gender-asymmetric default
-- scoring while still letting users express the "man-older-by-2-5-years"
-- convention (or any other) as a stated preference. The scorer will use the
-- user's stated min/max as full-credit range and apply tier-falloff outside.
--
-- Both columns nullable so existing profiles fall back to the v1.5 symmetric
-- tier scoring (no behavioral change for users who haven't set a preference).
-- ============================================================================

alter table public.profiles
  add column if not exists preferred_age_min integer,
  add column if not exists preferred_age_max integer;

-- Sanity check constraints (no negative, no absurd, min <= max when both set).
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name = 'profiles_preferred_age_min_range'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_age_min_range
      check (preferred_age_min is null or (preferred_age_min between 18 and 99));
  end if;

  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name = 'profiles_preferred_age_max_range'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_age_max_range
      check (preferred_age_max is null or (preferred_age_max between 18 and 99));
  end if;

  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name = 'profiles_preferred_age_order'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_age_order
      check (preferred_age_min is null or preferred_age_max is null or preferred_age_min <= preferred_age_max);
  end if;
end $$;

comment on column public.profiles.preferred_age_min is
  'Phase 41e (2026-06-13): user-stated minimum preferred age for matches. NULL means no preference (symmetric tier scoring used). Combined with preferred_age_max defines the user''s full-credit age range for scoring.';
comment on column public.profiles.preferred_age_max is
  'Phase 41e (2026-06-13): user-stated maximum preferred age for matches. NULL means no preference.';

-- Verification
do $$
declare
  v_min_exists boolean;
  v_max_exists boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'preferred_age_min'
  ) into v_min_exists;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'preferred_age_max'
  ) into v_max_exists;
  if v_min_exists and v_max_exists then
    raise notice 'Phase 41e age preference columns added successfully.';
  else
    raise warning 'Phase 41e migration ran but column check failed: min=%, max=%', v_min_exists, v_max_exists;
  end if;
end $$;
