-- Keeps updated_at current.
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Creates the public.profiles row for every new auth.users row.
-- role comes from raw_app_meta_data (only settable with the service_role key,
-- never by the user). raw_user_meta_data is user-controlled, so it is only
-- trusted for the display names. The email is auth's own column.
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  BEGIN
    v_role := COALESCE((NEW.raw_app_meta_data ->> 'role')::public.user_role, 'promoter');
  EXCEPTION WHEN invalid_text_representation THEN
    v_role := 'promoter';
  END;

  INSERT INTO public.profiles (id, first_name, last_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'first_name'), ''), 'User'),
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'last_name'), ''), 'Default'),
    v_role,
    NEW.email
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;

-- A signed-in user cannot change their OWN role or active flag (an
-- administrator could otherwise demote or deactivate themselves and leave
-- nobody able to manage users). Writes with no signed-in user (service_role,
-- the SQL editor) are not affected, so an administrator can still be set up
-- or fixed by hand.
-- Error the client should treat as final: P0001 / 'own_profile_locked'.
CREATE OR REPLACE FUNCTION private.protect_own_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.id = (SELECT auth.uid())
     AND (NEW.role IS DISTINCT FROM OLD.role
          OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    RAISE EXCEPTION 'own_profile_locked'
      USING ERRCODE = 'P0001',
            DETAIL = 'you cannot change your own role or active status';
  END IF;

  RETURN NEW;
END;
$$;
