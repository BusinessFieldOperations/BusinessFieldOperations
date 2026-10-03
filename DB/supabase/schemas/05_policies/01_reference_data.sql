-- Reference data: any ACTIVE user reads; only administrators write.

ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

CREATE POLICY states_select ON public.states
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY states_admin_all ON public.states
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.legal_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY legal_identity_select ON public.legal_identity
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY legal_identity_admin_all ON public.legal_identity
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select ON public.clients
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY clients_admin_all ON public.clients
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.client_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_states_select ON public.client_states
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY client_states_admin_all ON public.client_states
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.establishment ENABLE ROW LEVEL SECURITY;

CREATE POLICY establishment_select ON public.establishment
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY establishment_admin_all ON public.establishment
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY brands_select ON public.brands
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY brands_admin_all ON public.brands
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_select ON public.categories
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY categories_admin_all ON public.categories
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select ON public.products
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY products_admin_all ON public.products
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.product_establishment ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_establishment_select ON public.product_establishment
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY product_establishment_admin_all ON public.product_establishment
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
