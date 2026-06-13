-- ============================================================================
-- Patch for Phase 46 — RPC to list storage objects
-- 2026-06-12 23:45
--
-- The Edge Function tries this RPC first; without it, it falls back to a
-- direct schema("storage") query via PostgREST which fails because the
-- 'storage' schema isn't in the API's exposed_schemas list.
--
-- This SECURITY DEFINER RPC queries storage.objects from inside Postgres
-- where schema restrictions don't apply, returns just the candidates that
-- need backup (LEFT JOIN against the tracking table).
-- ============================================================================

create or replace function public.get_storage_backup_candidates(
  p_bucket text,
  p_limit int
)
returns table(
  name        text,
  updated_at  timestamptz,
  metadata    jsonb,
  etag        text
)
language plpgsql
security definer
set search_path = public, storage
as $func$
begin
  return query
  select
    o.name::text,
    o.updated_at,
    o.metadata,
    coalesce(o.metadata->>'eTag', null)::text as etag
  from storage.objects o
  left join public.storage_backup_tracking t
    on t.bucket = p_bucket
    and t.path  = o.name
  where o.bucket_id = p_bucket
    and (t.source_updated_at is null or o.updated_at > t.source_updated_at)
  order by o.updated_at asc
  limit p_limit;
end;
$func$;

grant execute on function public.get_storage_backup_candidates(text, int) to service_role;

comment on function public.get_storage_backup_candidates(text, int) is
  'Returns Supabase Storage objects in p_bucket that need to be backed up to S3. Phase 46 patch, 2026-06-12.';
