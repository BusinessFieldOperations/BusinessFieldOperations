ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_select_own ON public.tasks
  FOR SELECT TO authenticated
  USING (assigned_to = (SELECT auth.uid()) AND (SELECT private.is_active_user()));

CREATE POLICY tasks_admin_all ON public.tasks
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));