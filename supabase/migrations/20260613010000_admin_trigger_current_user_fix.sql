CREATE OR REPLACE FUNCTION public.enforce_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 2026-06-13 fix: was session_user (which doesn't change inside SECURITY DEFINER).
  -- current_user DOES become the owner inside a SECURITY DEFINER body, so this
  -- correctly bypasses the trigger for our 6 log_admin_* RPCs called by authenticated users.
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot modify role directly. Use log_admin_role_change().' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot modify status directly. Use log_admin_user_status_change() or log_admin_resolve_report().' USING ERRCODE = '42501';
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'Cannot modify is_verified directly. Use log_admin_toggle_verified() or log_admin_identity_verify().' USING ERRCODE = '42501';
  END IF;
  IF NEW.identity_verification_status IS DISTINCT FROM OLD.identity_verification_status THEN
    RAISE EXCEPTION 'Cannot modify identity_verification_status directly. Use log_admin_identity_verify().' USING ERRCODE = '42501';
  END IF;
  IF NEW.notes_admin IS DISTINCT FROM OLD.notes_admin THEN
    RAISE EXCEPTION 'Cannot modify notes_admin directly. Use log_admin_set_notes().' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
