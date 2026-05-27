-- Permanent fix: keep profiles.email_verified in sync with
-- auth.users.email_confirmed_at, automatically and forever.
--
-- WHY THIS EXISTS
-- ---------------
-- Before this migration, no mechanism existed to propagate Supabase's
-- email-verification flag (auth.users.email_confirmed_at) into the
-- application's profiles.email_verified column. ChatPage and other
-- gates read from profiles.email_verified, so verified users got
-- stuck in the "Confirm your email" loop forever.
--
-- A one-shot backfill UPDATE (run via SQL Editor on 2026-05-27)
-- repaired the existing 41 affected users. This migration installs
-- the triggers that prevent recurrence.
--
-- TWO TRIGGERS COVER ALL PATHS
-- ----------------------------
-- 1. BEFORE INSERT on public.profiles:
--    If the user's auth.users.email_confirmed_at is already set when
--    the profile row is first created (typical post-confirmation
--    onboarding flow), start with email_verified=true.
--
-- 2. AFTER UPDATE OF email_confirmed_at on auth.users:
--    When a user confirms their email (email_confirmed_at flips from
--    NULL to non-NULL), propagate to profiles.email_verified=true.
--    Also handles the rare reverse case (admin clears the flag).
--
-- Both functions are SECURITY DEFINER with SET search_path = '' and
-- fully-qualified object refs. Triggers on auth.users are a standard
-- Supabase pattern (the platform's own 'create profile on signup'
-- trigger uses the same shape).

BEGIN;

-- 1. BEFORE INSERT trigger on public.profiles
CREATE OR REPLACE FUNCTION public.set_email_verified_on_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = NEW.id
      AND email_confirmed_at IS NOT NULL
  ) THEN
    NEW.email_verified := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_email_verified_on_profile_insert ON public.profiles;
CREATE TRIGGER trg_set_email_verified_on_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_email_verified_on_profile_insert();

-- 2. AFTER UPDATE trigger on auth.users (column-scoped to email_confirmed_at)
CREATE OR REPLACE FUNCTION public.sync_email_verified_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Forward direction: email_confirmed_at flipped to non-NULL → set verified.
  IF NEW.email_confirmed_at IS NOT NULL
     AND (OLD.email_confirmed_at IS NULL
          OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  THEN
    UPDATE public.profiles
    SET email_verified = true
    WHERE id = NEW.id
      AND email_verified IS DISTINCT FROM true;
  END IF;

  -- Reverse direction: an admin cleared email_confirmed_at → unset verified.
  -- Rare event (manual auth intervention) but prevents stale chat access if it happens.
  IF NEW.email_confirmed_at IS NULL
     AND OLD.email_confirmed_at IS NOT NULL
  THEN
    UPDATE public.profiles
    SET email_verified = false
    WHERE id = NEW.id
      AND email_verified IS DISTINCT FROM false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_email_verified_from_auth ON auth.users;
CREATE TRIGGER trg_sync_email_verified_from_auth
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_email_verified_from_auth();

COMMIT;
