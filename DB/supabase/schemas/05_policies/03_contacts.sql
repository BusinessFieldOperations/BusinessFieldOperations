ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_select_own ON public.contacts
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND (SELECT private.is_active_user()));

CREATE POLICY contacts_insert_own ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()) AND (SELECT private.is_active_user()));

-- WITH CHECK keeps owner_id from being reassigned to someone else.
CREATE POLICY contacts_update_own ON public.contacts
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND (SELECT private.is_active_user()))
  WITH CHECK (owner_id = (SELECT auth.uid()) AND (SELECT private.is_active_user()));

-- Administrators: full control over everyone's contacts (including delete).
CREATE POLICY contacts_admin_all ON public.contacts
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
