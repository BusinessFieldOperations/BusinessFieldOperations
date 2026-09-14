DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('merchant', 'promoter', 'administrator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.merchant_report_details (
  report_id INTEGER REFERENCES public.merchant_reports(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
  salesfloor_inventory INTEGER NOT NULL CHECK (salesfloor_inventory >= 0),
  stockroom_inventory INTEGER NOT NULL CHECK (stockroom_inventory >= 0),
  total_units INTEGER NOT NULL CHECK (total_units = salesfloor_inventory + stockroom_inventory),
  PRIMARY KEY (report_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.promoter_report_details (
  report_id INTEGER REFERENCES public.promoter_reports(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
  initial_inventory INTEGER NOT NULL CHECK (initial_inventory >= 0),
  final_inventory INTEGER NOT NULL CHECK (final_inventory >= 0),
  total_sales INTEGER NOT NULL CHECK (total_sales = initial_inventory - final_inventory),
  PRIMARY KEY (report_id, product_id)
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT role = 'administrator' INTO is_admin
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN coalesce(is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'first_name', 'Unknown'),
    COALESCE(new.raw_user_meta_data->>'last_name', 'Unknown'),
    CAST(COALESCE(new.raw_user_meta_data->>'role', 'promoter') AS public.user_role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoter_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_report_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoter_report_details ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- PROFILES POLICIES
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
-- CATALOG POLICIES (Read-only for authenticated)
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
-- --------------------------------------------------------
DROP POLICY IF EXISTS "insert_own_merchant_report" ON public.merchant_reports;
DROP POLICY IF EXISTS "select_own_merchant_report" ON public.merchant_reports;
DROP POLICY IF EXISTS "insert_own_merchant_report_details" ON public.merchant_report_details;
DROP POLICY IF EXISTS "select_own_merchant_report_details" ON public.merchant_report_details;

CREATE POLICY "insert_own_merchant_report"
ON public.merchant_reports FOR INSERT TO authenticated
WITH CHECK (
  merchant_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'merchant' AND is_active = true)
);

CREATE POLICY "select_own_merchant_report"
ON public.merchant_reports FOR SELECT TO authenticated
USING (merchant_id = auth.uid() OR public.is_admin());

CREATE POLICY "insert_own_merchant_report_details"
ON public.merchant_report_details FOR INSERT TO authenticated
WITH CHECK (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = auth.uid()));

CREATE POLICY "select_own_merchant_report_details"
ON public.merchant_report_details FOR SELECT TO authenticated
USING (report_id IN (SELECT id FROM public.merchant_reports WHERE merchant_id = auth.uid()) OR public.is_admin());

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
  promoter_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'promoter' AND is_active = true)
);

CREATE POLICY "select_own_promoter_report"
ON public.promoter_reports FOR SELECT TO authenticated
USING (promoter_id = auth.uid() OR public.is_admin());

CREATE POLICY "insert_own_promoter_report_details"
ON public.promoter_report_details FOR INSERT TO authenticated
WITH CHECK (report_id IN (SELECT id FROM public.promoter_reports WHERE promoter_id = auth.uid()));

CREATE POLICY "select_own_promoter_report_details"
ON public.promoter_report_details FOR SELECT TO authenticated
USING (report_id IN (SELECT id FROM public.promoter_reports WHERE promoter_id = auth.uid()) OR public.is_admin());

-- ==============================================
-- 4. RPC ADMIN USER CREATION
-- ==============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
AS $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    hashed_password TEXT;
    result json;
BEGIN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only administrators can create users.';
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

    UPDATE public.profiles 
    SET role = user_role 
    WHERE id = new_user_id;

    result := json_build_object('status', 'success', 'user_id', new_user_id);
    RETURN result;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'A user with this email already exists.';
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to create user: %', SQLERRM;
END;
$$;