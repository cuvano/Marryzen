-- Behavioral email cadence: schedule email-cadence-tick every 30 minutes via pg_cron.
-- Edge Function lives at supabase/functions/email-cadence-tick.
-- The function reads profiles whose created_at falls in one of four windows (1h, 24h, 48h, 7d ago),
-- sends the matching template via Resend, and writes profiles.email_cadence_state to avoid double-sends.

create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table public.profiles
  add column if not exists email_cadence_state jsonb default '{}'::jsonb;

do $do$
begin
  perform cron.unschedule('email-cadence-tick');
exception when others then null;
end $do$;

select cron.schedule(
  'email-cadence-tick',
  '*/30 * * * *',
  $$ select net.http_post(
       url := 'https://adufstvmmzpqdcmpinqd.supabase.co/functions/v1/email-cadence-tick',
       headers := jsonb_build_object('X-Cron-Secret', 'marryzen-cron-2026', 'Content-Type', 'application/json'),
       body := '{}'::jsonb
     ); $$
);
