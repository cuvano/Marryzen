-- Cascade hard-delete for a user. SECURITY DEFINER (runs as owner) so it can
-- delete across all tables + auth.users regardless of RLS. Schema-agnostic:
-- it discovers every table with a FK to public.profiles and clears the user's
-- rows in repeated passes (so inter-table FK ordering resolves itself), then
-- deletes the profile and the auth login. Fixes deletes failing for users that
-- have messages / likes / reports / etc. referencing them.
create or replace function public.admin_hard_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  fk record;
  pass int;
begin
  -- Up to 6 passes; each pass deletes whatever it can, swallowing FK violations
  -- so dependent rows that block a parent on one pass get removed on a later one.
  for pass in 1..6 loop
    for fk in
      select tc.table_schema as ts, tc.table_name as tn, kcu.column_name as cn
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and ccu.table_schema = 'public' and ccu.table_name = 'profiles'
    loop
      begin
        execute format('delete from %I.%I where %I = $1', fk.ts, fk.tn, fk.cn) using p_user_id;
      exception when others then
        -- Log + retry on a later pass once this row's own dependents are gone.
        raise warning 'admin_hard_delete_user: deferred delete on %.% (%): %', fk.ts, fk.tn, fk.cn, sqlerrm;
      end;
    end loop;
  end loop;

  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

-- Only the service role (used by the admin-delete-user Edge Function, which does
-- the super_admin authz + audit) may execute this. Not anon/authenticated.
revoke all on function public.admin_hard_delete_user(uuid) from public;
revoke all on function public.admin_hard_delete_user(uuid) from anon;
revoke all on function public.admin_hard_delete_user(uuid) from authenticated;
grant execute on function public.admin_hard_delete_user(uuid) to service_role;
