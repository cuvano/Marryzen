-- ============================================================================
-- Verification result emails (Phase 52)
-- 2026-06-12
--
-- Wires automated approved/rejected emails for Didit identity verification.
--
-- Architecture:
--   * APPROVED emails fire instantly from the didit-webhook (v12) by invoking
--     the send-verification-result Edge Function synchronously.
--   * REJECTED emails are enqueued into pending_verification_rejections with
--     fire_at = now() + 1 hour. A pg_cron job runs every 5 minutes calling the
--     same Edge Function in "queue mode" — for each due row it re-checks the
--     user's current verification status, cancels the rejection if they've
--     since become verified (Didit auto-retry resolved it), or sends.
--
-- Why the delay? Board (T&S + Retention) agreed that immediate "we couldn't
-- verify" emails are too eager — Didit auto-retries and users self-correct
-- within minutes. A 60-minute deferred queue lets the resolution happen
-- silently and only emails users whose rejection actually stuck.
--
-- Reasons (text values used by the Edge Function to pick template):
--   * 'name_mismatch'    — Didit succeeded but ID name didn't match profile name
--   * 'document_quality' — Didit returned declined/rejected status
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.pending_verification_rejections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  reason       text not null check (reason in ('name_mismatch', 'document_quality')),
  fire_at      timestamptz not null,
  sent_at      timestamptz,
  canceled_at  timestamptz,
  cancel_reason text,
  created_at   timestamptz not null default now()
);

-- Indexes — cron will SELECT pending rows by fire_at; admins may query by user
create index if not exists idx_pending_rejections_due
  on public.pending_verification_rejections (fire_at)
  where sent_at is null and canceled_at is null;

create index if not exists idx_pending_rejections_user
  on public.pending_verification_rejections (user_id, created_at desc);

-- RLS — service role only. Users never read or write this directly.
alter table public.pending_verification_rejections enable row level security;
-- (no policies = no row visibility for authenticated users; service_role bypasses RLS)

comment on table public.pending_verification_rejections is
  '60-min delay queue for Didit verification rejection emails. Phase 52, 2026-06-12.';

-- ----------------------------------------------------------------------------
-- pg_cron — every 5 minutes call send-verification-result in queue mode
-- ----------------------------------------------------------------------------

do $do$
begin
  perform cron.unschedule('verification-rejection-queue');
exception when others then null;
end $do$;

select cron.schedule(
  'verification-rejection-queue',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://adufstvmmzpqdcmpinqd.supabase.co/functions/v1/send-verification-result',
       headers := jsonb_build_object('X-Cron-Secret', 'marryzen-cron-2026', 'Content-Type', 'application/json'),
       body := '{"mode":"queue"}'::jsonb
     ); $$
);
