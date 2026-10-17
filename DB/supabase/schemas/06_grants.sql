-- Table privileges are the coarse gate; RLS policies are the fine gate.
-- anon gets nothing: every table requires a signed-in user.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Profiles, tasks, reference data: RLS decides who may actually write.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles,
  public.tasks,
  public.states,
  public.legal_identity,
  public.clients,
  public.client_states,
  public.establishment,
  public.brands,
  public.categories,
  public.products,
  public.product_establishment
TO authenticated;

-- Contacts: RLS decides who may write. UPDATE is limited to the editable
-- columns, so captured_at (the idempotency key and the way offline edits find
-- their contact), owner_id and created_by can never be changed through the API.
-- updated_at is kept by the trigger, which is not subject to column grants.
GRANT SELECT, INSERT, DELETE ON public.contacts TO authenticated;
GRANT UPDATE (first_name, last_name, id_document, email, extra_fields)
  ON public.contacts TO authenticated;

-- Reports: append-only. No UPDATE for anyone.
GRANT SELECT, INSERT ON
  public.merchant_reports,
  public.merchant_report_salesfloors,
  public.merchant_report_inventory,
  public.promoter_reports,
  public.promoter_report_details
TO authenticated;

REVOKE ALL ON public.reports_feed FROM anon;
GRANT SELECT ON public.reports_feed TO authenticated;

-- Admins delete whole reports; children go away through ON DELETE CASCADE.
GRANT DELETE ON
  public.merchant_reports,
  public.promoter_reports
TO authenticated;


--- Reports as jsonb

REVOKE ALL ON FUNCTION public.submit_merchant_report (jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_promoter_report (jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_merchant_report (jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_promoter_report (jsonb) TO authenticated;

--- Contacts as jsonb

REVOKE ALL ON FUNCTION public.submit_contact (jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_contact (jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.update_contact (jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_contact (jsonb) TO authenticated;

-- Callable by any signed-in user, but it raises 'not_allowed' unless the
-- caller is an administrator.
REVOKE ALL ON FUNCTION public.assign_contact (jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_contact (jsonb, uuid[]) TO authenticated;
