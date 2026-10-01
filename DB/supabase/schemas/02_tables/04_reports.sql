-- Merchant

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
  observations TEXT,
  no_inventory BOOLEAN NOT NULL DEFAULT FALSE
);

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

-- Promoter

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
);

CREATE TABLE IF NOT EXISTS public.promoter_report_details (
  report_id INTEGER REFERENCES public.promoter_reports(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  initial_inventory INTEGER NOT NULL CHECK (initial_inventory >= 0),
  final_inventory INTEGER NOT NULL CHECK (final_inventory >= 0),
  restocked_units INTEGER NOT NULL DEFAULT 0 CHECK (restocked_units >= 0),
  total_sales INTEGER GENERATED ALWAYS AS (initial_inventory + restocked_units - final_inventory) STORED,
  PRIMARY KEY (report_id, product_id)
);
