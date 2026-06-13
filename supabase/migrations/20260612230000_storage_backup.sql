-- ============================================================================
-- Storage backup tracking + nightly cron (Phase 46)
-- 2026-06-12
--
-- The board's recommended DIY alternative to Supabase PITR:
--   * Daily DB backups (already in place — Pro tier default, 7-day retention)
--   * Nightly Supabase Storage → AWS S3 sync (this migration + storage-backup-tick)
--   * Total cost ~$1-3/mo vs $100/mo for PITR add-on
--
-- This closes the actual gap that even PITR doesn't cover: Storage objects
-- (profile photos, selfies) are NOT included in Supabase's DB backups. If you
-- ever restore the DB, photo URLs in profiles would point to objects that may
-- have been deleted since the backup. With this in place, you have an
-- independent S3 copy of every Storage object.
--
-- Architecture:
--   * Tracking table records every object that's been backed up (bucket, path,
--     source updated_at, S3 key, backed_up_at).
--   * Edge Function storage-backup-tick runs nightly via pg_cron at 03:00 UTC
--     (off-peak for EU-west-1 — Marryzen's Supabase region).
--   * Each tick scans storage.objects, LEFT JOINs the tracking table, and
--     syncs anything new or modified since last sync.
--   * Idempotent: re-runnable without dupes via PRIMARY KEY on (bucket, path).
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.storage_backup_tracking (
  bucket            text not null,
  path              text not null,
  source_etag       text,
  source_updated_at timestamptz,
  s3_key            text not null,
  s3_bucket         text not null,
  backed_up_at      timestamptz not null default now(),
  bytes             bigint,
  primary key (bucket, path)
);

create index if not exists idx_storage_backup_recent
  on public.storage_backup_tracking (backed_up_at desc);

alter table public.storage_backup_tracking enable row level security;
-- No policies = service role only (admins read via service key)

comment on table public.storage_backup_tracking is
  'S3 backup state tracker for Supabase Storage objects. Phase 46, 2026-06-12.';

-- ----------------------------------------------------------------------------
-- pg_cron — nightly at 03:00 UTC (off-peak for EU-west-1)
-- ----------------------------------------------------------------------------

do $do$
begin
  perform cron.unschedule('storage-backup-tick');
exception when others then null;
end $do$;

select cron.schedule(
  'storage-backup-tick',
  '0 3 * * *',
  $$ select net.http_post(
       url := 'https://adufstvmmzpqdcmpinqd.supabase.co/functions/v1/storage-backup-tick',
       headers := jsonb_build_object('X-Cron-Secret', 'marryzen-cron-2026', 'Content-Type', 'application/json'),
       body := '{}'::jsonb,
       timeout_milliseconds := 50000
     ); $$
);
