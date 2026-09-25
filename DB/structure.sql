-- =====================================================================
-- FIELD REPORTS SCHEMA (Supabase) - v2
-- Idempotent: safe to run on a fresh database AND on an existing one.
--
-- Pattern used
--   * CREATE TABLE IF NOT EXISTS   -> base shape. It NEVER alters a table that
--                                     already exists, so every later change
--                                     lives in an ALTER ... IF NOT EXISTS block.
--   * New rules on tables that may hold legacy rows are added as
--     CHECK ... NOT VALID: enforced for every new/updated row, legacy rows
--     are not scanned. Once legacy data is clean run, per constraint:
--         ALTER TABLE <t> VALIDATE CONSTRAINT <name>;
--
-- BREAKING CHANGES FOR THE APP
--   * total_units (merchant) and total_sales (promoter) are now GENERATED:
--     the client must stop sending them (inserting a value fails).
--   * merchant_report_details is replaced by merchant_report_salesfloors +
--     merchant_report_inventory.
--   * New reports must carry GPS + photo path(s) (see section 3 constraints).
-- =====================================================================

-- ==============================================
-- 1. TYPES
-- ==============================================
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('merchant', 'promoter', 'administrator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================
-- 2. BASE TABLES (unchanged)
-- ==============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  ci TEXT UNIQUE,
  role public.user_role DEFAULT 'promoter' NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
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

CREATE TABLE IF NOT EXISTS public.products (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  units_per_package INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.merchant_reports (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  state_id INTEGER REFERENCES public.states(id),
  salesman_name TEXT NOT NULL,
  merchant_id UUID REFERENCES public.profiles(id),
  zone TEXT NOT NULL,
  stablishment TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id)
);

CREATE TABLE IF NOT EXISTS public.promoter_reports (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  state_id INTEGER REFERENCES public.states(id),
  salesman_name TEXT NOT NULL,
  promoter_id UUID NOT NULL REFERENCES public.profiles(id),
  zone TEXT NOT NULL,
  stablishment TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id)
);

-- ==============================================
-- 3. REPORTS REFACTOR
-- ==============================================

-- 3.1 Report headers: GPS, photos, observations -------------------------
-- Photos are stored in Supabase Storage (bucket "report-photos", section 7);
-- the DB only keeps the object PATH, never a URL.
ALTER TABLE public.merchant_reports
  ADD COLUMN IF NOT EXISTS latitude             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_accuracy_m  REAL,
  ADD COLUMN IF NOT EXISTS arrival_photo_path   TEXT,
  ADD COLUMN IF NOT EXISTS departure_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS observations         TEXT,
  -- TRUE = visit reported without an inventory count. The report then cannot
  -- have inventory lines (trigger below). "Counted and found 0" is NOT this
  -- flag: that is a normal inventory line with all counters at 0.
  ADD COLUMN IF NOT EXISTS no_inventory         BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.promoter_reports
  ADD COLUMN IF NOT EXISTS latitude             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_accuracy_m  REAL,
  ADD COLUMN IF NOT EXISTS arrival_photo_path   TEXT;

-- 3.2 Merchant inventory: several salesfloors, ONE stockroom -------------
-- Salesfloors are defined per report (free label: "Gondola 2", "Isla", ...).
CREATE TABLE IF NOT EXISTS public.merchant_report_salesfloors (
  id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES public.merchant_reports(id) ON DELETE CASCADE,
  name      TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  UNIQUE (report_id, name),
  UNIQUE (report_id, id)   -- target of the composite FK below (line can only point to a salesfloor of ITS report)
);

-- One row per (report, product, location).
--   salesfloor_id IS NULL      -> the stockroom (at most one row per report+product)
--   salesfloor_id IS NOT NULL  -> that salesfloor
-- Damaged / expired units are counters on the same row (option 1). total_units
-- is generated, so it can never disagree with its parts.
CREATE TABLE IF NOT EXISTS public.merchant_report_inventory (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id     INTEGER NOT NULL REFERENCES public.merchant_reports(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  salesfloor_id INTEGER,
  good_units    INTEGER NOT NULL DEFAULT 0 CHECK (good_units >= 0),
  damaged_units INTEGER NOT NULL DEFAULT 0 CHECK (damaged_units >= 0),
  expired_units INTEGER NOT NULL DEFAULT 0 CHECK (expired_units >= 0),
  total_units   INTEGER GENERATED ALWAYS AS (good_units + damaged_units + expired_units) STORED,
  FOREIGN KEY (report_id, salesfloor_id)
    REFERENCES public.merchant_report_salesfloors (report_id, id) ON DELETE CASCADE
);

COMMENT ON COLUMN public.merchant_report_inventory.salesfloor_id IS 'NULL = stockroom';

CREATE UNIQUE INDEX IF NOT EXISTS merchant_inventory_stockroom_uq
  ON public.merchant_report_inventory (report_id, product_id)
  WHERE salesfloor_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS merchant_inventory_salesfloor_uq
  ON public.merchant_report_inventory (report_id, product_id, salesfloor_id)
  WHERE salesfloor_id IS NOT NULL;

-- Rejects inventory lines on a report flagged as no_inventory.
CREATE OR REPLACE FUNCTION public.check_merchant_inventory_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.merchant_reports WHERE id = NEW.report_id AND no_inventory) THEN
    RAISE EXCEPTION 'Report % is flagged as no_inventory and cannot have inventory lines.', NEW.report_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merchant_inventory_line ON public.merchant_report_inventory;
CREATE TRIGGER trg_merchant_inventory_line
  BEFORE INSERT ON public.merchant_report_inventory
  FOR EACH ROW EXECUTE FUNCTION public.check_merchant_inventory_line();

-- Per-product totals (same shape the old merchant_report_details used to give).
-- security_invoker => the caller's RLS applies to the underlying table.
CREATE OR REPLACE VIEW public.merchant_report_product_totals
WITH (security_invoker = true) AS
SELECT
  report_id,
  product_id,
  SUM(good_units) FILTER (WHERE salesfloor_id IS NULL)     AS stockroom_good_units,
  SUM(good_units) FILTER (WHERE salesfloor_id IS NOT NULL) AS salesfloor_good_units,
  SUM(good_units)                                          AS good_units,
  SUM(damaged_units)                                       AS damaged_units,
  SUM(expired_units)                                       AS expired_units,
  SUM(total_units)                                         AS total_units
FROM public.merchant_report_inventory
GROUP BY report_id, product_id;

-- 3.3 One-time data migration from the old merchant_report_details -------
-- Each legacy row becomes: 1 stockroom line + 1 line in a default salesfloor.
-- The old table is NOT dropped - do it by hand once you have checked the data:
--     DROP TABLE public.merchant_report_details;
DO $$
BEGIN
  IF to_regclass('public.merchant_report_details') IS NOT NULL THEN
    INSERT INTO public.merchant_report_salesfloors (report_id, name)
    SELECT DISTINCT report_id, 'Sala de ventas'
    FROM public.merchant_report_details
    ON CONFLICT (report_id, name) DO NOTHING;

    INSERT INTO public.merchant_report_inventory (report_id, product_id, salesfloor_id, good_units)
    SELECT d.report_id, d.product_id, NULL::integer, d.stockroom_inventory
    FROM public.merchant_report_details d
    ON CONFLICT DO NOTHING;

    INSERT INTO public.merchant_report_inventory (report_id, product_id, salesfloor_id, good_units)
    SELECT d.report_id, d.product_id, s.id, d.salesfloor_inventory
    FROM public.merchant_report_details d
    JOIN public.merchant_report_salesfloors s
      ON s.report_id = d.report_id AND s.name = 'Sala de ventas'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 3.4 Promoter details: no more negative sales ---------------------------
-- Old rule: CHECK (total_sales = initial - final). That only says "the stored
-- number equals the subtraction", so final > initial silently stored NEGATIVE
-- sales. Now: total_sales is generated and final can't exceed what was there.
-- restocked_units = units the promoter received DURING the shift (default 0).
-- If that never happens in your operation just leave it at 0 / ignore it.
CREATE TABLE IF NOT EXISTS public.promoter_report_details (
  report_id INTEGER REFERENCES public.promoter_reports(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
  initial_inventory INTEGER NOT NULL CHECK (initial_inventory >= 0),
  final_inventory INTEGER NOT NULL CHECK (final_inventory >= 0),
  PRIMARY KEY (report_id, product_id)
);

ALTER TABLE public.promoter_report_details
  ADD COLUMN IF NOT EXISTS restocked_units INTEGER NOT NULL DEFAULT 0 CHECK (restocked_units >= 0);

-- Legacy total_sales was a plain column: drop it (its old CHECK goes with it)
-- and recreate it as a generated column. Values are recomputed automatically.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'promoter_report_details'
      AND column_name  = 'total_sales'
      AND is_generated = 'NEVER'
  ) THEN
    ALTER TABLE public.promoter_report_details DROP COLUMN total_sales;
  END IF;
END $$;

ALTER TABLE public.promoter_report_details
  ADD COLUMN IF NOT EXISTS total_sales INTEGER
  GENERATED ALWAYS AS (initial_inventory + restocked_units - final_inventory) STORED;

-- Find legacy rows that already hold negative sales:
--   SELECT * FROM public.promoter_report_details WHERE total_sales < 0;

-- 3.5 Constraints (added only if missing; see header for NOT VALID) ------
-- To CHANGE one of these later: DROP CONSTRAINT it first, then re-run.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('merchant_reports', 'merchant_reports_location_chk',
       $c$CHECK (latitude IS NOT NULL AND longitude IS NOT NULL
                 AND latitude BETWEEN -90 AND 90
                 AND longitude BETWEEN -180 AND 180) NOT VALID$c$),
      ('merchant_reports', 'merchant_reports_accuracy_chk',
       $c$CHECK (location_accuracy_m IS NULL OR location_accuracy_m >= 0)$c$),
      ('merchant_reports', 'merchant_reports_photos_chk',
       $c$CHECK (length(btrim(coalesce(arrival_photo_path, ''))) > 0
                 AND length(btrim(coalesce(departure_photo_path, ''))) > 0) NOT VALID$c$),

      ('promoter_reports', 'promoter_reports_location_chk',
       $c$CHECK (latitude IS NOT NULL AND longitude IS NOT NULL
                 AND latitude BETWEEN -90 AND 90
                 AND longitude BETWEEN -180 AND 180) NOT VALID$c$),
      ('promoter_reports', 'promoter_reports_accuracy_chk',
       $c$CHECK (location_accuracy_m IS NULL OR location_accuracy_m >= 0)$c$),
      ('promoter_reports', 'promoter_reports_photo_chk',
       $c$CHECK (length(btrim(coalesce(arrival_photo_path, ''))) > 0) NOT VALID$c$),

      ('promoter_report_details', 'promoter_report_details_sales_chk',
       $c$CHECK (final_inventory <= initial_inventory + restocked_units) NOT VALID$c$)
    ) AS t(tbl, cname, def)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = c.cname
        AND conrelid = format('public.%I', c.tbl)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', c.tbl, c.cname, c.def);
    END IF;
  END LOOP;
END $$;

-- 3.6 Indexes used by the RLS policies -----------------------------------
CREATE INDEX IF NOT EXISTS merchant_reports_merchant_id_idx ON public.merchant_reports (merchant_id);
CREATE INDEX IF NOT EXISTS promoter_reports_promoter_id_idx ON public.promoter_reports (promoter_id);

-- ==============================================
-- 4. HELPER FUNCTIONS + NEW-USER TRIGGER
-- ==============================================

-- CHANGED: a deactivated administrator is no longer an administrator.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrator' AND is_active
  );
$$;

-- CHANGED (security): the role used to be read from raw_user_meta_data, which
-- the CLIENT controls on a public sign-up (anyone could register as
-- 'administrator'). raw_app_meta_data can only be written server-side.
-- create_user_by_admin() sets the final role explicitly anyway.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', 'Unknown'),
    COALESCE(new.raw_user_meta_data->>'last_name', 'Unknown'),
    CAST(COALESCE(new.raw_app_meta_data->>'role', 'promoter') AS public.user_role)
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==============================================
-- (SELECT auth.uid()) / (SELECT public.is_admin()) are wrapped so Postgres
-- evaluates them once per query instead of once per row (report policies only).

ALTER TABLE public.profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_states              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoter_reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_report_salesfloors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_report_inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoter_report_details    ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- PROFILES POLICIES (unchanged)
-- --------------------------------------------------------
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Administrators can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Administrators can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Administrators can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Administrators can delete profiles" ON public.profiles;

CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT TO authenticated USING ( auth.uid() = id );
CREATE POLICY "Administrators can view all profiles" ON public.profiles FOR SELECT TO authenticated USING ( public.is_admin() );
CREATE POLICY "Administrators can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK ( public.is_admin() );
CREATE POLICY "Administrators can update profiles" ON public.profiles FOR UPDATE TO authenticated USING ( public.is_admin() ) WITH CHECK ( public.is_admin() );
CREATE POLICY "Administrators can delete profiles" ON public.profiles FOR DELETE TO authenticated USING ( public.is_admin() );

-- --------------------------------------------------------
-- CATALOG POLICIES (unchanged; read-only for authenticated)
-- --------------------------------------------------------
DROP POLICY IF EXISTS "select_states" ON public.states;
DROP POLICY IF EXISTS "select_clients" ON public.clients;
DROP POLICY IF EXISTS "select_clients_states" ON public.clients_states;
DROP POLICY IF EXISTS "select_products" ON public.products;

CREATE POLICY "select_states" ON public.states FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_clients_states" ON public.clients_states FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_products" ON public.products FOR SELECT TO authenticated USING (true);

-- Admin write access for clients
DROP POLICY IF EXISTS "admin_insert_clients" ON public.clients;
DROP POLICY IF EXISTS "admin_update_clients" ON public.clients;
DROP POLICY IF EXISTS "admin_delete_clients" ON public.clients;
CREATE POLICY "admin_insert_clients" ON public.clients FOR INSERT TO authenticated WITH CHECK ( public.is_admin() );
CREATE POLICY "admin_update_clients" ON public.clients FOR UPDATE TO authenticated USING ( public.is_admin() ) WITH CHECK ( public.is_admin() );
CREATE POLICY "admin_delete_clients" ON public.clients FOR DELETE TO authenticated USING ( public.is_admin() );

-- Admin write access for products
DROP POLICY IF EXISTS "admin_insert_products" ON public.products;
DROP POLICY IF EXISTS "admin_update_products" ON public.products;
DROP POLICY IF EXISTS "admin_delete_products" ON public.products;
CREATE POLICY "admin_insert_products" ON public.products FOR INSERT TO authenticated WITH CHECK ( public.is_admin() );
CREATE POLICY "admin_update_products" ON public.products FOR UPDATE TO authenticated USING ( public.is_admin() ) WITH CHECK ( public.is_admin() );
CREATE POLICY "admin_delete_products" ON public.products FOR DELETE TO authenticated USING ( public.is_admin() );

-- Admin write access for states
DROP POLICY IF EXISTS "admin_insert_states" ON public.states;
DROP POLICY IF EXISTS "admin_update_states" ON public.states;
DROP POLICY IF EXISTS "admin_delete_states" ON public.states;
CREATE POLICY "admin_insert_states" ON public.states FOR INSERT TO authenticated WITH CHECK ( public.is_admin() );
CREATE POLICY "admin_update_states" ON public.states FOR UPDATE TO authenticated USING ( public.is_admin() ) WITH CHECK ( public.is_admin() );
CREATE POLICY "admin_delete_states" ON public.states FOR DELETE TO authenticated USING ( public.is_admin() );

-- Admin write access for clients_states
DROP POLICY IF EXISTS "admin_insert_clients_states" ON public.clients_states;
DROP POLICY IF EXISTS "admin_update_clients_states" ON public.clients_states;
DROP POLICY IF EXISTS "admin_delete_clients_states" ON public.clients_states;
CREATE POLICY "admin_insert_clients_states" ON public.clients_states FOR INSERT TO authenticated WITH CHECK ( public.is_admin() );
CREATE POLICY "admin_update_clients_states" ON public.clients_states FOR UPDATE TO authenticated USING ( public.is_admin() ) WITH CHECK ( public.is_admin() );
CREATE POLICY "admin_delete_clients_states" ON public.clients_states FOR DELETE TO authenticated USING ( public.is_admin() );

-- --------------------------------------------------------
-- MERCHANT REPORTS POLICIES
-- (reports are insert-only: no UPDATE/DELETE policy on purpose)
-- --------------------------------------------------------
DROP POLICY IF EXISTS "insert_own_merchant_report" ON public.merchant_reports;
DROP POLICY IF EXISTS "select_own_merchant_report" ON public.merchant_reports;
DROP POLICY IF EXISTS "insert_own_merchant_salesfloors" ON public.merchant_report_salesfloors;
DROP POLICY IF EXISTS "select_own_merchant_salesfloors" ON public.merchant_report_salesfloors;
DROP POLICY IF EXISTS "insert_own_merchant_inventory" ON public.merchant_report_inventory;
DROP POLICY IF EXISTS "select_own_merchant_inventory" ON public.merchant_report_inventory;

CREATE POLICY "insert_own_merchant_report"
ON public.merchant_reports FOR INSERT TO authenticated
WITH CHECK (
  merchant_id = (SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'merchant' AND is_active = true)
);

CREATE POLICY "select_own_merchant_report"
ON public.merchant_reports FOR SELECT TO authenticated
USING (merchant_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "insert_own_merchant_salesfloors"
ON public.merchant_report_salesfloors FOR INSERT TO authenticated
WITH CHECK (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = (SELECT auth.uid())));

CREATE POLICY "select_own_merchant_salesfloors"
ON public.merchant_report_salesfloors FOR SELECT TO authenticated
USING (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = (SELECT auth.uid())) OR (SELECT public.is_admin()));

CREATE POLICY "insert_own_merchant_inventory"
ON public.merchant_report_inventory FOR INSERT TO authenticated
WITH CHECK (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = (SELECT auth.uid())));

CREATE POLICY "select_own_merchant_inventory"
ON public.merchant_report_inventory FOR SELECT TO authenticated
USING (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = (SELECT auth.uid())) OR (SELECT public.is_admin()));

-- --------------------------------------------------------
-- PROMOTER REPORTS POLICIES
-- --------------------------------------------------------
DROP POLICY IF EXISTS "insert_own_promoter_report" ON public.promoter_reports;
DROP POLICY IF EXISTS "select_own_promoter_report" ON public.promoter_reports;
DROP POLICY IF EXISTS "insert_own_promoter_report_details" ON public.promoter_report_details;
DROP POLICY IF EXISTS "select_own_promoter_report_details" ON public.promoter_report_details;

CREATE POLICY "insert_own_promoter_report"
ON public.promoter_reports FOR INSERT TO authenticated
WITH CHECK (
  promoter_id = (SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'promoter' AND is_active = true)
);

CREATE POLICY "select_own_promoter_report"
ON public.promoter_reports FOR SELECT TO authenticated
USING (promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "insert_own_promoter_report_details"
ON public.promoter_report_details FOR INSERT TO authenticated
WITH CHECK (report_id IN (SELECT id FROM public.promoter_reports WHERE promoter_id = (SELECT auth.uid())));

CREATE POLICY "select_own_promoter_report_details"
ON public.promoter_report_details FOR SELECT TO authenticated
USING (report_id IN (SELECT id FROM public.promoter_reports WHERE promoter_id = (SELECT auth.uid())) OR (SELECT public.is_admin()));

-- ==============================================
-- 6. RPC ADMIN USER CREATION
-- ==============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- CHANGED: search_path pinned (SECURITY DEFINER hygiene; crypt()/gen_salt() live
-- in "extensions" on Supabase), and the "Access Denied" error is no longer
-- swallowed and re-wrapped by the WHEN OTHERS handler.
CREATE OR REPLACE FUNCTION public.create_user_by_admin(
    email_input TEXT,
    password_input TEXT,
    first_name TEXT,
    last_name TEXT,
    user_role public.user_role
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    hashed_password TEXT;
    result json;
BEGIN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only administrators can create users.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Hash the password using pgcrypto
    hashed_password := crypt(password_input, gen_salt('bf'));

    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change,
        email_change_token_new,
        raw_app_meta_data,
        raw_user_meta_data,
        aud,
        role,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        email_input,
        hashed_password,
        NOW(),
        '',
        '',
        '',
        '',
        '{"provider":"email","providers":["email"]}',
        json_build_object('first_name', first_name, 'last_name', last_name, 'role', user_role::text, 'email_verified', true),
        'authenticated',
        'authenticated',
        NOW(),
        NOW()
    );

    UPDATE auth.users
    SET confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change = COALESCE(email_change, ''),
        email_change_token_new = COALESCE(email_change_token_new, '')
    WHERE id = new_user_id;

    -- Insert into auth.identities
    INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        new_user_id::text,
        new_user_id,
        json_build_object('sub', new_user_id::text, 'email', email_input),
        'email',
        NOW(),
        NOW(),
        NOW()
    );

    -- The trigger created the profile (default role); set the requested one.
    UPDATE public.profiles
    SET role = user_role
    WHERE id = new_user_id;

    result := json_build_object('status', 'success', 'user_id', new_user_id);
    RETURN result;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE;
    WHEN unique_violation THEN
        RAISE EXCEPTION 'A user with this email already exists.';
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to create user: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_by_admin(TEXT, TEXT, TEXT, TEXT, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user_by_admin(TEXT, TEXT, TEXT, TEXT, public.user_role) TO authenticated;

-- ==============================================
-- 7. STORAGE: PRIVATE BUCKET FOR REPORT PHOTOS
-- ==============================================
-- Convention: upload to  <user_id>/<anything unique>/arrival.jpg
-- and save that path in *_photo_path. Read them with signed URLs (bucket is private).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-photos', 'report-photos', false,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "upload_own_report_photos" ON storage.objects;
DROP POLICY IF EXISTS "read_own_report_photos" ON storage.objects;

CREATE POLICY "upload_own_report_photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'report-photos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "read_own_report_photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'report-photos'
  AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR (SELECT public.is_admin()))
);

-- =====================================================================
-- FIELD REPORTS SCHEMA (Supabase) - v3
-- Run AFTER schema_v2.sql. Idempotent: safe to run more than once.
--
-- WHAT THIS FILE DOES
--   A. New catalogs: brands, categories (view: everyone; write: admin only)
--   B. products: add brand, category, display_quantity, sku (unique);
--      units_per_package becomes NUMERIC.
--   C. products.id: INTEGER -> UUID, and everything that points at it
--      (merchant_report_inventory.product_id, promoter_report_details.product_id)
--      migrated along with it.
--   D. New: public.contacts — a personal CRM agenda, one row per contact,
--      owned by whichever user created it.
--
-- BREAKING CHANGES FOR THE APP
--   * product_id is now a UUID STRING everywhere (API payloads, cached
--     product pickers, hardcoded ids in tests/seeds) — not an integer.
--   * Section C requires schema_v2.sql's merchant_report_details migration
--     to have already run. If public.merchant_report_details still holds
--     data you haven't verified against merchant_report_salesfloors /
--     merchant_report_inventory (see schema_v2.sql §3.3), check that FIRST —
--     this file drops that table as part of the id migration.
--   * Test on a branch/staging project before running against production.
-- =====================================================================

-- ==============================================================
-- SECTION A: BRANDS & CATEGORIES
-- ==============================================================
-- Same access pattern as clients/states/products: anyone authenticated can
-- read, only admins can write. The name itself is the primary key (matches
-- "brand FOREIGN KEY (TEXT)" in the product shape you gave), so there's no
-- separate surrogate id to keep in sync with products.brand/category.
-- If you'd rather brands/categories had their own id and allowed renames,
-- say so — that's a different (also reasonable) shape than what's below.
CREATE TABLE IF NOT EXISTS public.brands (
  name TEXT PRIMARY KEY CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.categories (
  name TEXT PRIMARY KEY CHECK (length(btrim(name)) > 0)
);

ALTER TABLE public.brands     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_brands" ON public.brands;
DROP POLICY IF EXISTS "admin_insert_brands" ON public.brands;
DROP POLICY IF EXISTS "admin_delete_brands" ON public.brands;
CREATE POLICY "select_brands" ON public.brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_insert_brands" ON public.brands FOR INSERT TO authenticated WITH CHECK ( (SELECT public.is_admin()) );
CREATE POLICY "admin_delete_brands" ON public.brands FOR DELETE TO authenticated USING ( (SELECT public.is_admin()) );

DROP POLICY IF EXISTS "select_categories" ON public.categories;
DROP POLICY IF EXISTS "admin_insert_categories" ON public.categories;
DROP POLICY IF EXISTS "admin_delete_categories" ON public.categories;
CREATE POLICY "select_categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_insert_categories" ON public.categories FOR INSERT TO authenticated WITH CHECK ( (SELECT public.is_admin()) );
CREATE POLICY "admin_delete_categories" ON public.categories FOR DELETE TO authenticated USING ( (SELECT public.is_admin()) );

-- No UPDATE policy — you asked for view + create + delete only. Since `name`
-- is the primary key, "renaming" isn't a plain UPDATE anyway: it would need
-- ON UPDATE CASCADE on products.brand/category's foreign keys below. Ask if
-- you need rename support later; it's a small addition, not implemented here.

-- ==============================================================
-- SECTION B: PRODUCTS — brand, category, sku, display_quantity
-- ==============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand             TEXT,
  ADD COLUMN IF NOT EXISTS category          TEXT,
  ADD COLUMN IF NOT EXISTS display_quantity  TEXT,
  ADD COLUMN IF NOT EXISTS sku               TEXT;

-- units_per_package: INTEGER -> NUMERIC (your spec said "NUMBER"), so a
-- package can carry a fractional unit count if that's ever needed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'units_per_package' AND data_type <> 'numeric'
  ) THEN
    ALTER TABLE public.products
      ALTER COLUMN units_per_package TYPE NUMERIC USING units_per_package::numeric;
  END IF;
END $$;

-- brand/category are nullable FKs (existing products won't have a value yet
-- — backfill separately or leave blank). sku is unique but nullable: several
-- products can have no sku, but two products can't share one.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('products', 'products_brand_fkey',    $c$FOREIGN KEY (brand) REFERENCES public.brands(name)$c$),
      ('products', 'products_category_fkey', $c$FOREIGN KEY (category) REFERENCES public.categories(name)$c$),
      ('products', 'products_sku_key',       $c$UNIQUE (sku)$c$),
      ('products', 'products_units_per_package_positive_chk',
       $c$CHECK (units_per_package > 0) NOT VALID$c$)
    ) AS t(tbl, cname, def)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = c.cname AND conrelid = format('public.%I', c.tbl)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', c.tbl, c.cname, c.def);
    END IF;
  END LOOP;
END $$;

-- Note: deleting a brand/category that's still referenced by a product is
-- REJECTED by default (no ON DELETE clause = RESTRICT-like) rather than
-- silently blanking the product's brand — reassign products first.

-- ==============================================================
-- SECTION C: PRODUCTS.id  INTEGER -> UUID  (cascades to product_id elsewhere)
-- ==============================================================
-- Guarded so this only runs once (checks the CURRENT type of products.id).
-- If a DROP CONSTRAINT below errors with "constraint does not exist", your
-- database named it differently than Postgres's default convention — find
-- the real name with:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.products'::regclass;
-- and substitute it, then re-run.
-- ==============================================================
-- SECTION C: PRODUCTS.id  INTEGER -> UUID  (cascades to product_id elsewhere)
-- ==============================================================
DO $$
DECLARE
  id_type text;
BEGIN
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'id';

  IF id_type IS DISTINCT FROM 'uuid' THEN

    IF to_regclass('public.merchant_report_details') IS NOT NULL THEN
      DROP TABLE public.merchant_report_details;
    END IF;

    -- 1. Give every product a UUID alongside its current integer id.
    ALTER TABLE public.products ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid() NOT NULL;

    -- 2. Carry that mapping into every table that points at products.id
    ALTER TABLE public.merchant_report_inventory ADD COLUMN product_id_uuid UUID;
    UPDATE public.merchant_report_inventory t
      SET product_id_uuid = p.id_uuid
      FROM public.products p
      WHERE p.id = t.product_id;

    ALTER TABLE public.promoter_report_details ADD COLUMN product_id_uuid UUID;
    UPDATE public.promoter_report_details t
      SET product_id_uuid = p.id_uuid
      FROM public.products p
      WHERE p.id = t.product_id;

    -- 3. Drop everything typed against the old integer column.
    
    -- ---> FIX: Drop the dependent view first <---
    DROP VIEW IF EXISTS public.merchant_report_product_totals;

    ALTER TABLE public.merchant_report_inventory DROP CONSTRAINT IF EXISTS merchant_report_inventory_product_id_fkey;
    DROP INDEX IF EXISTS public.merchant_inventory_stockroom_uq;
    DROP INDEX IF EXISTS public.merchant_inventory_salesfloor_uq;

    ALTER TABLE public.promoter_report_details DROP CONSTRAINT IF EXISTS promoter_report_details_product_id_fkey;
    ALTER TABLE public.promoter_report_details DROP CONSTRAINT IF EXISTS promoter_report_details_pkey;

    -- 4. Swap columns: drop the integer one, promote the uuid one in its place.
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

    -- 5. Re-attach FKs / PK / indexes to the new uuid columns.
    ALTER TABLE public.merchant_report_inventory
      ADD CONSTRAINT merchant_report_inventory_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX merchant_inventory_stockroom_uq
      ON public.merchant_report_inventory (report_id, product_id) WHERE salesfloor_id IS NULL;
    CREATE UNIQUE INDEX merchant_inventory_salesfloor_uq
      ON public.merchant_report_inventory (report_id, product_id, salesfloor_id) WHERE salesfloor_id IS NOT NULL;

    ALTER TABLE public.promoter_report_details
      ADD CONSTRAINT promoter_report_details_pkey PRIMARY KEY (report_id, product_id);
    ALTER TABLE public.promoter_report_details
      ADD CONSTRAINT promoter_report_details_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

  END IF;
END $$;

-- ---> FIX: Recreate the view so it compiles against the new UUID product_id <---
CREATE OR REPLACE VIEW public.merchant_report_product_totals
WITH (security_invoker = true) AS
SELECT
  report_id,
  product_id,
  SUM(good_units) FILTER (WHERE salesfloor_id IS NULL)     AS stockroom_good_units,
  SUM(good_units) FILTER (WHERE salesfloor_id IS NOT NULL) AS salesfloor_good_units,
  SUM(good_units)                                          AS good_units,
  SUM(damaged_units)                                       AS damaged_units,
  SUM(expired_units)                                       AS expired_units,
  SUM(total_units)                                         AS total_units
FROM public.merchant_report_inventory
GROUP BY report_id, product_id;

-- ==============================================================
-- SECTION D: CRM — CONTACTS
-- ==============================================================
-- A personal agenda for ANY authenticated user (merchant, promoter, or
-- administrator): each contact belongs to exactly one owner. Unlike reports,
-- contacts ARE editable and deletable by their owner — this is a live CRM
-- record, not an immutable visit log.
CREATE TABLE IF NOT EXISTS public.contacts (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL CHECK (length(btrim(first_name)) > 0),
  last_name    TEXT NOT NULL CHECK (length(btrim(last_name)) > 0),
  id_document  TEXT,                                -- CI / RIF / any national ID, free text
  email        TEXT,
  extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,   -- arbitrary key: value pairs
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contacts_extra_fields_is_object CHECK (jsonb_typeof(extra_fields) = 'object'),
  CONSTRAINT contacts_email_format_chk
    CHECK (email IS NULL OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') NOT VALID
);

CREATE INDEX IF NOT EXISTS contacts_owner_id_idx ON public.contacts (owner_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_contacts" ON public.contacts;
DROP POLICY IF EXISTS "insert_own_contacts" ON public.contacts;
DROP POLICY IF EXISTS "update_own_contacts" ON public.contacts;
DROP POLICY IF EXISTS "delete_own_contacts" ON public.contacts;

-- Admins can VIEW every contact (so nothing is lost if someone leaves the
-- team) but cannot edit or delete another user's contacts — only the owner
-- can. Add `OR (SELECT public.is_admin())` to the update/delete USING
-- clauses too if you want admins to have full control instead.
CREATE POLICY "select_own_contacts"
ON public.contacts FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "insert_own_contacts"
ON public.contacts FOR INSERT TO authenticated
WITH CHECK (
  owner_id = (SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_active = true)
);

CREATE POLICY "update_own_contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "delete_own_contacts"
ON public.contacts FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));