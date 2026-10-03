-- Table privileges are the coarse gate; RLS policies are the fine gate.
-- anon gets nothing: every table requires a signed-in user.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Profiles, contacts, reference data: RLS decides who may actually write.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles,
  public.contacts,
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

-- Reports: append-only. No UPDATE for anyone.
GRANT SELECT, INSERT ON
  public.merchant_reports,
  public.merchant_report_salesfloors,
  public.merchant_report_inventory,
  public.promoter_reports,
  public.promoter_report_details
TO authenticated;

-- Admins delete whole reports; children go away through ON DELETE CASCADE.
GRANT DELETE ON
  public.merchant_reports,
  public.promoter_reports
TO authenticated;
