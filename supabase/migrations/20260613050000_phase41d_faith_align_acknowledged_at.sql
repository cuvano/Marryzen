-- ============================================================================
-- Phase 41d — Faith-aligned matchmaking acknowledgment audit column
-- 2026-06-13 05:00
--
-- Board-approved companion to Phase 41a deal-breakers + Phase 41b intent
-- matrix. Implements the P2 path from `Muslim_Women_Filter_Decision_2026-06-13.md`
-- (strong-default + interstitial, NOT a hard rule).
--
-- This column timestamps when the user explicitly acknowledged the faith-
-- aligned matchmaking choice via the onboarding interstitial. Required for
-- GDPR Art. 22 defensibility: we need an audit trail showing the user made
-- an active, informed choice (vs. a default that was silently applied).
--
-- For Muslim women specifically the interstitial defaults the
-- "Continue with faith-aligned matches" button to glowing-primary, which
-- sets dealbreaker_faith = true. The "Show me all faiths" button sets
-- dealbreaker_faith = false. Either choice writes `faith_align_acknowledged_at`
-- to now() so we can prove (in a DSR / regulator audit) that the user
-- saw the interstitial and made a deliberate choice.
--
-- For users who are NOT (Muslim AND Woman), the interstitial does not
-- appear and this column stays null. They use the generic Settings
-- MatchPreferencesCard surface like everyone else.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists faith_align_acknowledged_at timestamptz;

comment on column public.profiles.faith_align_acknowledged_at is
  'Phase 41d (2026-06-13): timestamp the user explicitly acknowledged the faith-aligned matchmaking choice via the onboarding interstitial (Muslim + Woman only). NULL means the interstitial has not yet been presented (e.g. user is not Muslim+Woman, or signed up before this feature shipped, or has not completed the relevant onboarding step). Required for GDPR Art. 22 defensibility audit trail.';

-- Verification
do $$
declare
  v_exists boolean;
begin
  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'profiles'
       and column_name  = 'faith_align_acknowledged_at'
  ) into v_exists;
  if v_exists then
    raise notice 'Phase 41d faith_align_acknowledged_at column added successfully.';
  else
    raise warning 'Phase 41d migration ran but column was not found.';
  end if;
end $$;
