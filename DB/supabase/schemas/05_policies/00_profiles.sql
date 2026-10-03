ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone (even inactive) can read their own profile.
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- Only active administrators can read/insert/update/delete any profile.
-- Regular users have NO write policy: they cannot change their own role/is_active.
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
