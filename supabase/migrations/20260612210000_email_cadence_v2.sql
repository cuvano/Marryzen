-- ============================================================================
-- Email Cadence v2 + Founding-500 cohort gating (Phase 50 + 51)
-- 2026-06-12
--
-- Builds on top of supabase/migrations/20260522010000_email_cadence_schedule.sql
-- which already:
--   * Added profiles.email_cadence_state jsonb default '{}'
--   * Scheduled the email-cadence-tick cron */30 * * * * with X-Cron-Secret header
--
-- This migration:
--   1. Adds profiles.founding_member boolean column (default false)
--   2. Adds a BEFORE INSERT trigger that atomically sets founding_member=true
--      until first of: (a) 500 members reached, (b) 2026-09-15T23:59:59Z UTC
--   3. Adds an index on (email_cadence_state->>'stage') for the cron's
--      candidate-scan query.
--   4. Initializes email_cadence_state on existing profiles to a sensible
--      starting stage so the v2 function has a clean baseline.
-- ============================================================================

-- 1) founding_member column
alter table public.profiles
  add column if not exists founding_member boolean not null default false;

create index if not exists idx_profiles_founding_member
  on public.profiles (founding_member)
  where founding_member = true;

-- 2) Atomic cohort-gating trigger
create or replace function public.set_founding_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  current_count int;
  cutoff_date timestamptz := '2026-09-15T23:59:59+00:00';
begin
  -- Honor manual overrides (admin can pre-flag VIPs by inserting founding_member=true)
  if new.founding_member is true then
    return new;
  end if;

  -- Past the cutoff date: cohort closed
  if now() >= cutoff_date then
    new.founding_member := false;
    return new;
  end if;

  -- Serialize the count check so concurrent INSERTs can't both see count=499.
  -- The lock is held until the surrounding INSERT transaction commits.
  perform pg_advisory_xact_lock(hashtext('marryzen_founding_member_gate'));

  select count(*) into current_count
  from public.profiles
  where founding_member = true;

  if current_count < 500 then
    new.founding_member := true;
  else
    new.founding_member := false;
  end if;

  return new;
end;
$func$;

drop trigger if exists profiles_set_founding_member on public.profiles;
create trigger profiles_set_founding_member
  before insert on public.profiles
  for each row
  execute function public.set_founding_member();

-- 3) Index on email_cadence_state stage for cron query
-- (stage lives inside the jsonb; use an expression index)
create index if not exists idx_profiles_cadence_stage
  on public.profiles ((email_cadence_state->>'stage'));

-- 4) Initialize email_cadence_state for existing profiles.
-- The v2 Edge Function expects {stage, transitioned_at, lock_until, sends}.
-- Use 'done' for profiles that already pre-date this migration so we don't
-- retroactively spam ~30 test users. Future signups get 'signup' via default
-- application-side init (or first-tick auto-initialization, see Edge Function).
do $$
declare
  v_now_iso text := to_jsonb(now() at time zone 'utc')::text;
begin
  update public.profiles
  set email_cadence_state = jsonb_build_object(
    'stage', 'done',
    'transitioned_at', to_jsonb(now() at time zone 'utc'),
    'lock_until', null,
    'sends', jsonb_build_object(
      'welcome', null,
      'founding_welcome', null,
      'profile_nudge', null,
      'verify_nudge', null,
      're_engagement', null
    ),
    'note', 'pre-v2 backfill — cadence suppressed for existing users'
  )
  where email_cadence_state is null
     or email_cadence_state = '{}'::jsonb
     or email_cadence_state->>'stage' is null;
end
$$;

-- ============================================================================
-- After applying this migration, deploy supabase/functions/email-cadence-tick
-- and the cron will start sending behavioral emails on the next tick.
-- ============================================================================
