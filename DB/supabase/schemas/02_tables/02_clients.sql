CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  rif TEXT NOT NULL UNIQUE
)

CREATE TABLE IF NOT EXISTS public.client_states (
  client_id UUID    NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  state_id  INTEGER NOT NULL REFERENCES public.states(id)  ON DELETE RESTRICT,
  PRIMARY KEY (client_id, state_id)
);