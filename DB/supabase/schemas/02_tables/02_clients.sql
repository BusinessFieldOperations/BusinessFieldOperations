CREATE TABLE IF NOT EXISTS public.legal_identity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rif TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind public.legal_identity_type DEFAULT 'client' NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  legal_identity_id UUID NOT NULL UNIQUE REFERENCES public.legal_identity (id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.client_states (
  client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  state_id INTEGER NOT NULL REFERENCES public.states (id) ON DELETE RESTRICT,
  PRIMARY KEY (client_id, state_id)
);

CREATE TABLE IF NOT EXISTS public.establishment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  state_id INTEGER NOT NULL REFERENCES public.states (id) ON DELETE RESTRICT,
  location TEXT NOT NULL,
  legal_identity_id UUID NOT NULL REFERENCES public.legal_identity (id) ON DELETE RESTRICT,
  branch_name TEXT
);