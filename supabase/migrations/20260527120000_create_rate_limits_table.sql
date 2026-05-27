-- Postgres-backed rate-limit counters for the rate-limit Edge Function.
-- Replaces the prior in-memory Map<> store which was per-isolate and reset
-- on cold-start, making rate limits effectively unenforceable.
--
-- See: supabase/functions/rate-limit/index.ts (the function that calls
-- check_rate_limit() below).

-- 1. Counter table: one row per (identifier, type) pair tracking the current window.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  identifier  TEXT        NOT NULL,
  rate_type   TEXT        NOT NULL,
  count       INTEGER     NOT NULL DEFAULT 0,
  reset_at    TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, rate_type)
);

-- Index used by the cleanup job.
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
  ON public.rate_limits (reset_at);

-- 2. Lock down RLS — only service-role calls (Edge Function with service-role
--    key) can read/write. No policies means regular authenticated/anon users
--    get nothing.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 3. Atomic check-and-increment RPC.
--    Increments the counter for (identifier, rate_type), starting a new window
--    if the old one has expired. Returns whether the request is allowed
--    (count <= limit) along with the new count, reset time, and retry-after
--    seconds when blocked.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier      TEXT,
  p_rate_type       TEXT,
  p_limit           INTEGER,
  p_window_seconds  INTEGER
) RETURNS TABLE(
  allowed         BOOLEAN,
  current_count   INTEGER,
  reset_at        TIMESTAMPTZ,
  retry_after     INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now       TIMESTAMPTZ := NOW();
  v_new_reset TIMESTAMPTZ := v_now + (p_window_seconds || ' seconds')::INTERVAL;
  v_row       public.rate_limits;
BEGIN
  -- Upsert + conditional window reset in one atomic statement.
  -- If the prior reset_at has passed, start a brand-new window with count=1.
  -- Otherwise increment in place.
  INSERT INTO public.rate_limits (identifier, rate_type, count, reset_at, updated_at)
  VALUES (p_identifier, p_rate_type, 1, v_new_reset, v_now)
  ON CONFLICT (identifier, rate_type) DO UPDATE
    SET count    = CASE WHEN rate_limits.reset_at <= v_now THEN 1
                        ELSE rate_limits.count + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at <= v_now THEN v_new_reset
                        ELSE rate_limits.reset_at END,
        updated_at = v_now
  RETURNING * INTO v_row;

  -- NOTE: no `AS <name>` aliases here. The RETURNS TABLE OUT-params declare
  -- the column names; aliasing the SELECT columns to the same names creates
  -- an ambiguous reference in PG and throws at runtime. Column positions
  -- align with the RETURNS TABLE declaration, which is what matters.
  RETURN QUERY SELECT
    (v_row.count <= p_limit),
    v_row.count,
    v_row.reset_at,
    GREATEST(0, EXTRACT(EPOCH FROM (v_row.reset_at - v_now))::INTEGER);
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- 4. Cleanup helper. Call from a cron job (or pg_cron) to prevent the table
--    from growing unbounded. Deletes rows whose window expired more than 1
--    day ago.
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE reset_at < NOW() - INTERVAL '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO service_role;

-- 5. Recommended: schedule the cleanup via pg_cron once enabled.
--    To enable pg_cron in Supabase: Dashboard → Database → Extensions → pg_cron.
--    Then run (separately, not in this migration since it depends on the
--    extension being available):
--
--      SELECT cron.schedule(
--        'cleanup-rate-limits',
--        '0 * * * *',                              -- top of every hour
--        $$ SELECT public.cleanup_expired_rate_limits(); $$
--      );
--
--    Until that's scheduled, the table will grow by ~1 row per
--    (identifier, rate_type) combo per hour. Negligible for early-stage
--    traffic but worth enabling before scale.
