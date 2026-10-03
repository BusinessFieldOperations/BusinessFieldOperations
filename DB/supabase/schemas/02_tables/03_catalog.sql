CREATE TABLE IF NOT EXISTS public.brands (
  name TEXT PRIMARY KEY CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.categories (
  name TEXT PRIMARY KEY CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients (id) ON DELETE RESTRICT,
  units_per_package NUMERIC NOT NULL CHECK (units_per_package > 0),
  brand TEXT REFERENCES public.brands (name) ON UPDATE CASCADE ON DELETE RESTRICT,
  category TEXT REFERENCES public.categories (name) ON UPDATE CASCADE ON DELETE RESTRICT,
  display_quantity TEXT,
  sku TEXT UNIQUE,
  is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_establishment (
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishment (id) ON DELETE RESTRICT,
  PRIMARY KEY (product_id, establishment_id)
);