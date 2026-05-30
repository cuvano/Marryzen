-- Admin audit log: append-only record of privileged admin actions
-- (delete_user, and future email-change etc). Writable ONLY by the service role
-- (Edge Functions); admins/super_admins can read. No update/delete policy =>
-- rows cannot be edited or removed by any normal client.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text not null,
  target_id uuid,
  target_email text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log_read" on public.admin_audit_log;
create policy "admin_audit_log_read" on public.admin_audit_log
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin','super_admin'))
  );

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_id);
