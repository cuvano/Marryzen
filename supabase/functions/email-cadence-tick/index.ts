// @ts-nocheck
// Deployed copy at supabase.com/dashboard/.../functions/email-cadence-tick
// Scheduled via pg_cron every 30 minutes (see supabase/migrations/...).
//
// Sends T+1h / T+24h / T+48h / T+7d behavioral emails from welcome-email-cadence.md.
// Tracks state in profiles.email_cadence_state to be idempotent.
//
// (Same content as the deployed function — keep them in sync if you edit either.)
