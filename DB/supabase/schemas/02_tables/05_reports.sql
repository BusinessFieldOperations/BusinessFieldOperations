-- Merchant
CREATE TABLE IF NOT EXISTS public.merchant_reports (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Must be frozen with the first Send click, never alter
  captured_at TIMESTAMPTZ NOT NULL,
  -- When the server received it.
  submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  state_id INTEGER NOT NULL REFERENCES public.states (id),
  client_id UUID NOT NULL REFERENCES public.clients (id),
  salesman_name TEXT NOT NULL,
  merchant_id UUID NOT NULL DEFAULT auth.uid () REFERENCES public.profiles (id) ON DELETE RESTRICT,
  zone TEXT NOT NULL,
  search_text TEXT GENERATED ALWAYS AS (lower(salesman_name || ' ' || zone)) STORED,
  establishment_id UUID NOT NULL REFERENCES public.establishment (id),
  latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  location_accuracy_m REAL CHECK (location_accuracy_m >= 0),
  observations TEXT,
  no_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  task_id UUID NOT NULL,

  -- A retry of an already received report carries the same pair.
  CONSTRAINT uq_merchant_reports_owner_captured
    UNIQUE (merchant_id, captured_at),
  CONSTRAINT fk_merchant_reports_client_state
    FOREIGN KEY (client_id, state_id)
    REFERENCES public.client_states (client_id, state_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_merchant_reports_task
    FOREIGN KEY (task_id, merchant_id, establishment_id)
    REFERENCES public.tasks (id, assigned_to, establishment_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.merchant_report_salesfloors (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES public.merchant_reports (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  UNIQUE (report_id, name),
  UNIQUE (report_id, id)
);

CREATE TABLE IF NOT EXISTS public.merchant_report_inventory (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES public.merchant_reports (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  salesfloor_id INTEGER,
  good_units INTEGER NOT NULL DEFAULT 0 CHECK (good_units >= 0),
  damaged_units INTEGER NOT NULL DEFAULT 0 CHECK (damaged_units >= 0),
  expired_units INTEGER NOT NULL DEFAULT 0 CHECK (expired_units >= 0),
  total_units INTEGER GENERATED ALWAYS AS (good_units + damaged_units + expired_units) STORED,
  FOREIGN KEY (report_id, salesfloor_id) REFERENCES public.merchant_report_salesfloors (report_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_merchant_inventory_row UNIQUE NULLS NOT DISTINCT (report_id, product_id, salesfloor_id)
);

-- Promoter
CREATE TABLE IF NOT EXISTS public.promoter_reports (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  state_id INTEGER REFERENCES public.states (id),
  client_id UUID REFERENCES public.clients (id),
  salesman_name TEXT NOT NULL,
  promoter_id UUID NOT NULL DEFAULT auth.uid () REFERENCES public.profiles (id) ON DELETE RESTRICT,
  zone TEXT NOT NULL,
  search_text TEXT GENERATED ALWAYS AS (lower(salesman_name || ' ' || zone)) STORED,
  establishment_id UUID NOT NULL REFERENCES public.establishment (id),
  latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  location_accuracy_m REAL CHECK (location_accuracy_m >= 0),
  task_id UUID NOT NULL,

  CONSTRAINT uq_promoter_reports_owner_captured
    UNIQUE (promoter_id, captured_at),
  CONSTRAINT fk_promoter_reports_client_state
    FOREIGN KEY (client_id, state_id)
    REFERENCES public.client_states (client_id, state_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_promoter_reports_task
    FOREIGN KEY (task_id, promoter_id, establishment_id)
    REFERENCES public.tasks (id, assigned_to, establishment_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.promoter_report_details (
  report_id INTEGER REFERENCES public.promoter_reports (id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products (id) ON DELETE RESTRICT,
  initial_inventory INTEGER NOT NULL CHECK (initial_inventory >= 0),
  final_inventory INTEGER NOT NULL CHECK (final_inventory >= 0),
  restocked_units INTEGER NOT NULL DEFAULT 0 CHECK (restocked_units >= 0),
  total_sales INTEGER GENERATED ALWAYS AS (
    initial_inventory + restocked_units - final_inventory
  ) STORED,
  PRIMARY KEY (report_id, product_id),
  CONSTRAINT chk_final_inventory_valid CHECK (
    final_inventory <= initial_inventory + restocked_units
  )
);

-- Indexes
-- The UNIQUE (owner, captured_at) constraints above already create the index
-- that serves each owner's own feed, so only the admin-wide ordering and the
CREATE INDEX IF NOT EXISTS idx_merchant_reports_task_id ON public.merchant_reports (task_id);
CREATE INDEX IF NOT EXISTS idx_promoter_reports_task_id ON public.promoter_reports (task_id);

CREATE INDEX IF NOT EXISTS idx_merchant_reports_search_trgm
  ON public.merchant_reports USING gin (search_text extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_promoter_reports_search_trgm
  ON public.promoter_reports USING gin (search_text extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_merchant_reports_feed_order
  ON public.merchant_reports (captured_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_promoter_reports_feed_order
  ON public.promoter_reports (captured_at DESC, id DESC);

-- View: unified feed, ordered by captured_at (the real event time).
CREATE OR REPLACE VIEW public.reports_feed
WITH (security_invoker = true) AS
SELECT
  'merchant'::text AS kind,
  r.id,
  r.captured_at,
  r.submitted_at,
  r.salesman_name,
  r.zone,
  r.establishment_id,
  r.client_id,
  r.state_id,
  r.search_text
FROM public.merchant_reports AS r
UNION ALL
SELECT
  'promoter'::text AS kind,
  r.id,
  r.captured_at,
  r.submitted_at,
  r.salesman_name,
  r.zone,
  r.establishment_id,
  r.client_id,
  r.state_id,
  r.search_text
FROM public.promoter_reports AS r;
