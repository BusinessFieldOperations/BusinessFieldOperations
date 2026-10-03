-- Keeps updated_at current.
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Creates the public.profiles row for every new auth.users row.
-- role comes from raw_app_meta_data (only settable with the service_role key,
-- never by the user). raw_user_meta_data is user-controlled, so it is only
-- trusted for the display names.
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

  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'first_name'), ''), 'User'),
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'last_name'), ''), 'Default'),
    v_role
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
