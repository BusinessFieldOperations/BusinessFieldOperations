CREATE TABLE IF NOT EXISTS public.brands (
  name TEXT PRIMARY KEY CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.categories (
  name TEXT PRIMARY KEY CHECK (length(btrim(name)) > 0)
);

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