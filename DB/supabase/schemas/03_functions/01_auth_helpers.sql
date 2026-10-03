-- SECURITY DEFINER so they can read public.profiles without triggering its RLS
-- (avoids infinite recursion when policies on profiles call them).
-- Empty search_path + fully qualified names = safe against search_path hijacking.

-- Role of the current user, or NULL if there is no profile or the user is inactive.
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
    AND p.is_active;
$$;

-- True if the current user has a profile and is_active = true.
CREATE OR REPLACE FUNCTION private.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_active
  );
$$;

-- True if the current user is an ACTIVE administrator.
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_active
      AND p.role = 'administrator'
  );
$$;
