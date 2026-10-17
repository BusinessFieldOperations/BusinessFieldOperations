ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- A user sees every contact that belongs to them, including the ones an
-- administrator assigned (created_by <> owner_id).
CREATE POLICY contacts_select_own ON public.contacts
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND (SELECT private.is_active_user()));

-- A user only creates contacts for themselves, and cannot pretend somebody
-- else created them.
CREATE POLICY contacts_insert_own ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.is_active_user())
  );

-- A user edits only what they created for themselves: contacts assigned by an
-- administrator are read-only for them. WITH CHECK keeps owner_id / created_by
-- from being changed (the column grants in 06_grants.sql also forbid it).
CREATE POLICY contacts_update_own ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.is_active_user())
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.is_active_user())
  );

-- No DELETE policy for users: only administrators delete.

-- Administrators: full control over everyone's contacts (including delete and
-- assigning contacts to other users).
CREATE POLICY contacts_admin_all ON public.contacts
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
