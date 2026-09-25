-- ====================================================================================
-- FIELD REPORTS SCHEMA (Supabase) - UNIFIED & REFACTORED
-- Idempotent: safe to run on a fresh database AND on an existing one.
-- ====================================================================================

-- ====================================================================================
-- SECTION 1: EXTENSIONS & CUSTOM TYPES
-- ====================================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('merchant', 'promoter', 'administrator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ====================================================================================
-- SECTION 2: USERS & PROFILES
-- ====================================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  ci TEXT UNIQUE,
  role public.user_role DEFAULT 'promoter' NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- ====================================================================================
-- SECTION 3: CATALOGS (Brands, Categories, States, Clients, Products)
-- ====================================================================================
CREATE TABLE IF NOT EXISTS public.brands (
  name TEXT PRIMARY KEY CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.categories (
  name TEXT PRIMARY KEY CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.states (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  rif TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.clients_states (
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  state_id INTEGER REFERENCES public.states(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, state_id)
);

-- PRODUCT TABLE (Final Shape)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  units_per_package NUMERIC NOT NULL,
  brand TEXT REFERENCES public.brands(name) ON DELETE RESTRICT,
  category TEXT REFERENCES public.categories(name) ON DELETE RESTRICT,
  display_quantity TEXT,
  sku TEXT UNIQUE
);
-- Catch-up for older databases: Add v3 columns if they don't exist
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS display_quantity TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT;

-- Catch-up for older databases: Migrate units_per_package from INT to NUMERIC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'units_per_package' AND data_type <> 'numeric'
  ) THEN
    ALTER TABLE public.products ALTER COLUMN units_per_package TYPE NUMERIC USING units_per_package::numeric;
  END IF;
END $$;


-- ====================================================================================
-- SECTION 4: REPORTS (Merchant & Promoter)
-- ====================================================================================
CREATE TABLE IF NOT EXISTS public.merchant_reports (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  state_id INTEGER REFERENCES public.states(id),
  salesman_name TEXT NOT NULL,
  merchant_id UUID REFERENCES public.profiles(id),
  zone TEXT NOT NULL,
  stablishment TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_accuracy_m REAL,
  arrival_photo_path TEXT,
  departure_photo_path TEXT,
  observations TEXT,
  no_inventory BOOLEAN NOT NULL DEFAULT FALSE
);
-- Catch-up for older databases
ALTER TABLE public.merchant_reports
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_accuracy_m REAL,
  ADD COLUMN IF NOT EXISTS arrival_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS departure_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS observations TEXT,
  ADD COLUMN IF NOT EXISTS no_inventory BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.merchant_report_salesfloors (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES public.merchant_reports(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  UNIQUE (report_id, name),
  UNIQUE (report_id, id)
);

CREATE TABLE IF NOT EXISTS public.merchant_report_inventory (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES public.merchant_reports(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  salesfloor_id INTEGER,
  good_units INTEGER NOT NULL DEFAULT 0 CHECK (good_units >= 0),
  damaged_units INTEGER NOT NULL DEFAULT 0 CHECK (damaged_units >= 0),
  expired_units INTEGER NOT NULL DEFAULT 0 CHECK (expired_units >= 0),
  total_units INTEGER GENERATED ALWAYS AS (good_units + damaged_units + expired_units) STORED,
  FOREIGN KEY (report_id, salesfloor_id) REFERENCES public.merchant_report_salesfloors (report_id, id) ON DELETE CASCADE
);
COMMENT ON COLUMN public.merchant_report_inventory.salesfloor_id IS 'NULL = stockroom';

CREATE TABLE IF NOT EXISTS public.promoter_reports (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  state_id INTEGER REFERENCES public.states(id),
  salesman_name TEXT NOT NULL,
  promoter_id UUID NOT NULL REFERENCES public.profiles(id),
  zone TEXT NOT NULL,
  stablishment TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_accuracy_m REAL,
  arrival_photo_path TEXT
);
-- Catch-up for older databases
ALTER TABLE public.promoter_reports
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_accuracy_m REAL,
  ADD COLUMN IF NOT EXISTS arrival_photo_path TEXT;

CREATE TABLE IF NOT EXISTS public.promoter_report_details (
  report_id INTEGER REFERENCES public.promoter_reports(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  initial_inventory INTEGER NOT NULL CHECK (initial_inventory >= 0),
  final_inventory INTEGER NOT NULL CHECK (final_inventory >= 0),
  restocked_units INTEGER NOT NULL DEFAULT 0 CHECK (restocked_units >= 0),
  total_sales INTEGER GENERATED ALWAYS AS (initial_inventory + restocked_units - final_inventory) STORED,
  PRIMARY KEY (report_id, product_id)
);
-- Catch-up for older databases: Add restocked units
ALTER TABLE public.promoter_report_details
  ADD COLUMN IF NOT EXISTS restocked_units INTEGER NOT NULL DEFAULT 0 CHECK (restocked_units >= 0);


-- ====================================================================================
-- SECTION 5: CRM
-- ====================================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK (length(btrim(first_name)) > 0),
  last_name TEXT NOT NULL CHECK (length(btrim(last_name)) > 0),
  id_document TEXT,
  email TEXT,
  extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contacts_extra_fields_is_object CHECK (jsonb_typeof(extra_fields) = 'object'),
  CONSTRAINT contacts_email_format_chk CHECK (email IS NULL OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') NOT VALID
);
CREATE INDEX IF NOT EXISTS contacts_owner_id_idx ON public.contacts (owner_id);


-- ====================================================================================
-- SECTION 6: LEGACY DATA MIGRATIONS (Executes ONLY if DB is old)
-- ====================================================================================

-- 6.1 Promoter Details: Recreate `total_sales` as GENERATED
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promoter_report_details'
      AND column_name = 'total_sales' AND is_generated = 'NEVER'
  ) THEN
    ALTER TABLE public.promoter_report_details DROP COLUMN total_sales;
    ALTER TABLE public.promoter_report_details ADD COLUMN total_sales INTEGER GENERATED ALWAYS AS (initial_inventory + restocked_units - final_inventory) STORED;
  END IF;
END $$;

-- 6.2 Merchant Details: Migrate old legacy data to the new Salesfloors/Inventory tables
DO $$
BEGIN
  IF to_regclass('public.merchant_report_details') IS NOT NULL THEN
    INSERT INTO public.merchant_report_salesfloors (report_id, name)
    SELECT DISTINCT report_id, 'Sala de ventas' FROM public.merchant_report_details ON CONFLICT (report_id, name) DO NOTHING;

    INSERT INTO public.merchant_report_inventory (report_id, product_id, salesfloor_id, good_units)
    SELECT d.report_id, d.product_id, NULL::integer, d.stockroom_inventory FROM public.merchant_report_details d ON CONFLICT DO NOTHING;

    INSERT INTO public.merchant_report_inventory (report_id, product_id, salesfloor_id, good_units)
    SELECT d.report_id, d.product_id, s.id, d.salesfloor_inventory
    FROM public.merchant_report_details d JOIN public.merchant_report_salesfloors s ON s.report_id = d.report_id AND s.name = 'Sala de ventas'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 6.3 Products: Migrate `id` from INTEGER to UUID
DO $$
DECLARE
  id_type text;
BEGIN
  SELECT data_type INTO id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'id';

  IF id_type IS DISTINCT FROM 'uuid' THEN
    IF to_regclass('public.merchant_report_details') IS NOT NULL THEN
      DROP TABLE public.merchant_report_details;
    END IF;

    ALTER TABLE public.products ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid() NOT NULL;
    ALTER TABLE public.merchant_report_inventory ADD COLUMN product_id_uuid UUID;
    UPDATE public.merchant_report_inventory t SET product_id_uuid = p.id_uuid FROM public.products p WHERE p.id = t.product_id;
    ALTER TABLE public.promoter_report_details ADD COLUMN product_id_uuid UUID;
    UPDATE public.promoter_report_details t SET product_id_uuid = p.id_uuid FROM public.products p WHERE p.id = t.product_id;

    DROP VIEW IF EXISTS public.merchant_report_product_totals;

    ALTER TABLE public.merchant_report_inventory DROP CONSTRAINT IF EXISTS merchant_report_inventory_product_id_fkey;
    DROP INDEX IF EXISTS public.merchant_inventory_stockroom_uq;
    DROP INDEX IF EXISTS public.merchant_inventory_salesfloor_uq;
    ALTER TABLE public.promoter_report_details DROP CONSTRAINT IF EXISTS promoter_report_details_product_id_fkey;
    ALTER TABLE public.promoter_report_details DROP CONSTRAINT IF EXISTS promoter_report_details_pkey;

    ALTER TABLE public.merchant_report_inventory DROP COLUMN product_id;
    ALTER TABLE public.merchant_report_inventory RENAME COLUMN product_id_uuid TO product_id;
    ALTER TABLE public.merchant_report_inventory ALTER COLUMN product_id SET NOT NULL;
    ALTER TABLE public.promoter_report_details DROP COLUMN product_id;
    ALTER TABLE public.promoter_report_details RENAME COLUMN product_id_uuid TO product_id;
    ALTER TABLE public.promoter_report_details ALTER COLUMN product_id SET NOT NULL;

    ALTER TABLE public.products DROP CONSTRAINT products_pkey;
    ALTER TABLE public.products DROP COLUMN id;
    ALTER TABLE public.products RENAME COLUMN id_uuid TO id;
    ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);

    ALTER TABLE public.merchant_report_inventory ADD CONSTRAINT merchant_report_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
    ALTER TABLE public.promoter_report_details ADD CONSTRAINT promoter_report_details_pkey PRIMARY KEY (report_id, product_id);
    ALTER TABLE public.promoter_report_details ADD CONSTRAINT promoter_report_details_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ====================================================================================
-- SECTION 7: VIEWS, FUNCTIONS, TRIGGERS & CONSTRAINTS
-- ====================================================================================
CREATE UNIQUE INDEX IF NOT EXISTS merchant_inventory_stockroom_uq ON public.merchant_report_inventory (report_id, product_id) WHERE salesfloor_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS merchant_inventory_salesfloor_uq ON public.merchant_report_inventory (report_id, product_id, salesfloor_id) WHERE salesfloor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS merchant_reports_merchant_id_idx ON public.merchant_reports (merchant_id);
CREATE INDEX IF NOT EXISTS promoter_reports_promoter_id_idx ON public.promoter_reports (promoter_id);

-- VIEW: Recreate totals safely now that all tables have correct types
DROP VIEW IF EXISTS public.merchant_report_product_totals;
CREATE OR REPLACE VIEW public.merchant_report_product_totals WITH (security_invoker = true) AS
SELECT
  report_id, product_id,
  SUM(good_units) FILTER (WHERE salesfloor_id IS NULL) AS stockroom_good_units,
  SUM(good_units) FILTER (WHERE salesfloor_id IS NOT NULL) AS salesfloor_good_units,
  SUM(good_units) AS good_units, SUM(damaged_units) AS damaged_units, SUM(expired_units) AS expired_units, SUM(total_units) AS total_units
FROM public.merchant_report_inventory
GROUP BY report_id, product_id;

-- FUNCTION & TRIGGER: Validate merchant inventory
CREATE OR REPLACE FUNCTION public.check_merchant_inventory_line() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.merchant_reports WHERE id = NEW.report_id AND no_inventory) THEN
    RAISE EXCEPTION 'Report % is flagged as no_inventory and cannot have inventory lines.', NEW.report_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_merchant_inventory_line ON public.merchant_report_inventory;
CREATE TRIGGER trg_merchant_inventory_line BEFORE INSERT ON public.merchant_report_inventory FOR EACH ROW EXECUTE FUNCTION public.check_merchant_inventory_line();

-- FUNCTION & TRIGGER: Set updated_at for CRM Contacts
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FUNCTION: Is Admin Check
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrator' AND is_active);
$$;

-- FUNCTION & TRIGGER: Handle New Users
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id, COALESCE(new.raw_user_meta_data->>'first_name', 'Unknown'), COALESCE(new.raw_user_meta_data->>'last_name', 'Unknown'),
    CAST(COALESCE(new.raw_app_meta_data->>'role', 'promoter') AS public.user_role)
  );
  RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- IDEMPOTENT CONSTRAINTS
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('products', 'products_brand_fkey', 'FOREIGN KEY (brand) REFERENCES public.brands(name)'),
      ('products', 'products_category_fkey', 'FOREIGN KEY (category) REFERENCES public.categories(name)'),
      ('products', 'products_sku_key', 'UNIQUE (sku)'),
      ('products', 'products_units_per_package_positive_chk', 'CHECK (units_per_package > 0) NOT VALID'),
      ('merchant_reports', 'merchant_reports_location_chk', 'CHECK (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180) NOT VALID'),
      ('merchant_reports', 'merchant_reports_accuracy_chk', 'CHECK (location_accuracy_m IS NULL OR location_accuracy_m >= 0)'),
      ('merchant_reports', 'merchant_reports_photos_chk', 'CHECK (length(btrim(coalesce(arrival_photo_path, ''''))) > 0 AND length(btrim(coalesce(departure_photo_path, ''''))) > 0) NOT VALID'),
      ('promoter_reports', 'promoter_reports_location_chk', 'CHECK (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180) NOT VALID'),
      ('promoter_reports', 'promoter_reports_accuracy_chk', 'CHECK (location_accuracy_m IS NULL OR location_accuracy_m >= 0)'),
      ('promoter_reports', 'promoter_reports_photo_chk', 'CHECK (length(btrim(coalesce(arrival_photo_path, ''''))) > 0) NOT VALID'),
      ('promoter_report_details', 'promoter_report_details_sales_chk', 'CHECK (final_inventory <= initial_inventory + restocked_units) NOT VALID')
    ) AS t(tbl, cname, def)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.cname AND conrelid = format('public.%I', c.tbl)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', c.tbl, c.cname, c.def);
    END IF;
  END LOOP;
END $$;


-- ====================================================================================
-- SECTION 8: AUTHENTICATION (ADMIN RPC)
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.create_user_by_admin(email_input TEXT, password_input TEXT, first_name TEXT, last_name TEXT, user_role public.user_role)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    hashed_password TEXT;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access Denied: Only administrators can create users.' USING ERRCODE = 'insufficient_privilege'; END IF;
    hashed_password := crypt(password_input, gen_salt('bf'));
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change, email_change_token_new,
        raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
    ) VALUES (
        new_user_id, '00000000-0000-0000-0000-000000000000', email_input, hashed_password, NOW(), '', '', '', '',
        '{"provider":"email","providers":["email"]}', json_build_object('first_name', first_name, 'last_name', last_name, 'role', user_role::text, 'email_verified', true),
        'authenticated', 'authenticated', NOW(), NOW()
    );
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_user_id::text, new_user_id, json_build_object('sub', new_user_id::text, 'email', email_input), 'email', NOW(), NOW(), NOW());
    UPDATE public.profiles SET role = user_role WHERE id = new_user_id;
    RETURN json_build_object('status', 'success', 'user_id', new_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.create_user_by_admin(TEXT, TEXT, TEXT, TEXT, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user_by_admin(TEXT, TEXT, TEXT, TEXT, public.user_role) TO authenticated;


-- ====================================================================================
-- SECTION 9: ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoter_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_report_salesfloors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_report_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoter_report_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- 9.1 Profiles
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Administrators can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Administrators can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Administrators can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Administrators can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

-- 9.2 Catalogs (Read-All, Write-Admin)
CREATE POLICY "select_catalogs" ON public.brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_catalogs" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_catalogs" ON public.states FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_catalogs" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_catalogs" ON public.clients_states FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_catalogs" ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_all_brands" ON public.brands AS PERMISSIVE FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_categories" ON public.categories AS PERMISSIVE FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_states" ON public.states AS PERMISSIVE FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_clients" ON public.clients AS PERMISSIVE FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_clients_states" ON public.clients_states AS PERMISSIVE FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_products" ON public.products AS PERMISSIVE FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9.3 Merchant Reports
CREATE POLICY "insert_own_merchant_report" ON public.merchant_reports FOR INSERT TO authenticated WITH CHECK (merchant_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'merchant' AND is_active = true));
CREATE POLICY "select_own_merchant_report" ON public.merchant_reports FOR SELECT TO authenticated USING (merchant_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY "insert_own_merchant_salesfloors" ON public.merchant_report_salesfloors FOR INSERT TO authenticated WITH CHECK (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = (SELECT auth.uid())));
CREATE POLICY "select_own_merchant_salesfloors" ON public.merchant_report_salesfloors FOR SELECT TO authenticated USING (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = (SELECT auth.uid())) OR (SELECT public.is_admin()));
CREATE POLICY "insert_own_merchant_inventory" ON public.merchant_report_inventory FOR INSERT TO authenticated WITH CHECK (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = (SELECT auth.uid())));
CREATE POLICY "select_own_merchant_inventory" ON public.merchant_report_inventory FOR SELECT TO authenticated USING (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = (SELECT auth.uid())) OR (SELECT public.is_admin()));

-- 9.4 Promoter Reports
CREATE POLICY "insert_own_promoter_report" ON public.promoter_reports FOR INSERT TO authenticated WITH CHECK (promoter_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'promoter' AND is_active = true));
CREATE POLICY "select_own_promoter_report" ON public.promoter_reports FOR SELECT TO authenticated USING (promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY "insert_own_promoter_report_details" ON public.promoter_report_details FOR INSERT TO authenticated WITH CHECK (report_id IN (SELECT id FROM public.promoter_reports WHERE promoter_id = (SELECT auth.uid())));
CREATE POLICY "select_own_promoter_report_details" ON public.promoter_report_details FOR SELECT TO authenticated USING (report_id IN (SELECT id FROM public.promoter_reports WHERE promoter_id = (SELECT auth.uid())) OR (SELECT public.is_admin()));

-- 9.5 CRM Contacts
CREATE POLICY "select_own_contacts" ON public.contacts FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY "insert_own_contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_active = true));
CREATE POLICY "update_own_contacts" ON public.contacts FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "delete_own_contacts" ON public.contacts FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));


-- ====================================================================================
-- SECTION 10: STORAGE (Private Bucket for Report Photos)
-- ====================================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-photos', 'report-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "upload_own_report_photos" ON storage.objects;
DROP POLICY IF EXISTS "read_own_report_photos" ON storage.objects;

CREATE POLICY "upload_own_report_photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "read_own_report_photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'report-photos' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR (SELECT public.is_admin())));