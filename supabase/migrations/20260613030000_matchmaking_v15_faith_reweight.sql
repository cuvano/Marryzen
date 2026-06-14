-- ============================================================================
-- Phase 41 (v1.5) — Matchmaking faith-first re-weighting
-- 2026-06-13 03:00
--
-- Board-approved (3-agent consult: Product/Growth, Brand/Founder, T&S/Risk).
-- Companion to src/lib/matchmaking.js code change shipped in the same release.
-- Decision doc: C:\Marryzen\Matchmaking_v1.5_Decision_2026-06-13.md
--
-- What this migration does:
--   Updates the seeded row in public.matching_config so admin UI defaults
--   match the new code defaults. Super_admin can still override at any time
--   via /admin/matching.
--
-- Before:    age 15, distance 15, intent 20, faith 15, values 15, cultures 10, lifestyle 15, completeness 5
-- After:     age 12, distance 12, intent 18, faith 28, values 13, cultures 7,  lifestyle 8,  completeness 2
-- Sum:       100 (preserved — admin UI validator requires this)
--
-- Why:  faith-first product wedge demands that faith weight be the dominant
--       compatibility signal. v1's 15% put faith on par with age/distance,
--       inconsistent with the brand promise. v1.5's 28% makes faith the
--       largest single dimension. Companion code change tightens the
--       same-religion-group fallback bonus from 0.6 to 0.4 so two
--       Christianity sub-denominations score ~40% of faith weight instead
--       of ~60% — corrects the Catholic+Protestant=92% screenshot risk.
--
-- Idempotent: safe to re-run; updates row in place. Only updates the
-- weights jsonb if the existing row still has the v1 defaults (so a
-- manual admin override is never silently clobbered).
-- ============================================================================

do $$
declare
  v_existing jsonb;
  v_v1_defaults jsonb := jsonb_build_object(
    'age', 15, 'distance', 15, 'intent', 20, 'faith', 15,
    'values', 15, 'cultures', 10, 'lifestyle', 15, 'completeness', 5
  );
  v_v15_defaults jsonb := jsonb_build_object(
    'age', 12, 'distance', 12, 'intent', 18, 'faith', 28,
    'values', 13, 'cultures', 7, 'lifestyle', 8, 'completeness', 2
  );
begin
  select weights into v_existing
  from public.matching_config
  order by created_at asc
  limit 1;

  if v_existing is null then
    raise notice 'matching_config has no rows — code default in src/lib/matchmaking.js will be used. Skipping update.';
    return;
  end if;

  -- Only update if the existing row still has v1 defaults (no admin override).
  -- Compare ordering-insensitively: cast both to jsonb and check equality.
  if v_existing = v_v1_defaults then
    update public.matching_config
    set weights = v_v15_defaults,
        updated_at = now()
    where weights = v_v1_defaults;
    raise notice 'matching_config updated to v1.5 faith-first weights.';
  else
    raise notice 'matching_config weights differ from v1 defaults — skipping to preserve admin override. Manual super_admin update via /admin/matching is required to adopt v1.5 defaults.';
  end if;
end $$;

-- Verification query (admin runs this after migration to confirm):
-- select weights, updated_at from public.matching_config order by created_at asc limit 1;
