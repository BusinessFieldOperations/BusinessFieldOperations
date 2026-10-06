-- Merchant reports: append-only (no UPDATE policy/grant for anyone).
ALTER TABLE public.merchant_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_reports_select ON public.merchant_reports
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_admin())
    OR (merchant_id = (SELECT auth.uid()) AND (SELECT private.is_active_user()))
  );

CREATE POLICY merchant_reports_insert ON public.merchant_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    merchant_id = (SELECT auth.uid())
    AND (SELECT private.current_user_role()) = 'merchant'
    AND EXISTS (
      SELECT 1 FROM public.tasks AS t
      WHERE t.id = merchant_reports.task_id
        AND t.assigned_to = (SELECT auth.uid())
        AND t.completed_at IS NULL
    )
  );

CREATE POLICY merchant_reports_admin_delete ON public.merchant_reports
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

ALTER TABLE public.merchant_report_salesfloors ENABLE ROW LEVEL SECURITY;

-- Visible exactly when the parent report is visible (parent RLS applies inside EXISTS).
CREATE POLICY merchant_report_salesfloors_select ON public.merchant_report_salesfloors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_reports AS r
      WHERE r.id = merchant_report_salesfloors.report_id
    )
  );

-- Only the owner (with the right role) can add rows to their own report.
CREATE POLICY merchant_report_salesfloors_insert ON public.merchant_report_salesfloors
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.current_user_role()) = 'merchant'
    AND EXISTS (
      SELECT 1 FROM public.merchant_reports AS r
      WHERE r.id = merchant_report_salesfloors.report_id
        AND r.merchant_id = (SELECT auth.uid())
    )
  );

ALTER TABLE public.merchant_report_inventory ENABLE ROW LEVEL SECURITY;

-- Visible exactly when the parent report is visible (parent RLS applies inside EXISTS).
CREATE POLICY merchant_report_inventory_select ON public.merchant_report_inventory
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_reports AS r
      WHERE r.id = merchant_report_inventory.report_id
    )
  );

-- Only the owner (with the right role) can add rows to their own report.
CREATE POLICY merchant_report_inventory_insert ON public.merchant_report_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.current_user_role()) = 'merchant'
    AND EXISTS (
      SELECT 1 FROM public.merchant_reports AS r
      WHERE r.id = merchant_report_inventory.report_id
        AND r.merchant_id = (SELECT auth.uid())
    )
  );

-- Promoter reports: append-only (no UPDATE policy/grant for anyone).
ALTER TABLE public.promoter_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY promoter_reports_select ON public.promoter_reports
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_admin())
    OR (promoter_id = (SELECT auth.uid()) AND (SELECT private.is_active_user()))
  );

CREATE POLICY promoter_reports_insert ON public.promoter_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    promoter_id = (SELECT auth.uid())
    AND (SELECT private.current_user_role()) = 'promoter'
    AND EXISTS (
      SELECT 1 FROM public.tasks AS t
      WHERE t.id = promoter_reports.task_id
        AND t.assigned_to = (SELECT auth.uid())
        AND t.completed_at IS NULL
    )
  );

CREATE POLICY promoter_reports_admin_delete ON public.promoter_reports
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

ALTER TABLE public.promoter_report_details ENABLE ROW LEVEL SECURITY;

-- Visible exactly when the parent report is visible (parent RLS applies inside EXISTS).
CREATE POLICY promoter_report_details_select ON public.promoter_report_details
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.promoter_reports AS r
      WHERE r.id = promoter_report_details.report_id
    )
  );

-- Only the owner (with the right role) can add rows to their own report.
CREATE POLICY promoter_report_details_insert ON public.promoter_report_details
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.current_user_role()) = 'promoter'
    AND EXISTS (
      SELECT 1 FROM public.promoter_reports AS r
      WHERE r.id = promoter_report_details.report_id
        AND r.promoter_id = (SELECT auth.uid())
    )
  );
