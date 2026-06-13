-- ============================================================================
-- Fix: rename audit_logs columns to match log_admin_* RPC contract
-- 2026-06-13 02:00
--
-- The live audit_logs table was created by an earlier migration (not in this
-- repo) with columns admin_id, action, target_user_id, details. The six
-- log_admin_* RPCs in 20260609010000_admin_audit_rpc_and_lockdown.sql, and
-- the two log_premium_* RPCs in 20260607020000_premium_grants_time_bounded.sql,
-- INSERT into (actor_id, action, target_user_id, payload). The column-name
-- mismatch blew up on the first real role-change attempt with:
--   ERROR 42703: column "actor_id" of relation "audit_logs" does not exist.
--
-- This migration renames the legacy columns to the names the RPCs expect.
-- Idempotent guard around each rename so re-running is a no-op.
-- ============================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'admin_id') then
    alter table public.audit_logs rename column admin_id to actor_id;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'details') then
    alter table public.audit_logs rename column details to payload;
  end if;
end $$;
