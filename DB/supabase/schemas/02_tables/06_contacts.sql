CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captured_at TIMESTAMP WITH TIMESTAMPTZ NOT NULL,
  owner_id UUID NOT NULL DEFAULT auth.uid () REFERENCES public.profiles (id) ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK (length(btrim(first_name)) > 0),
  last_name TEXT NOT NULL CHECK (length(btrim(last_name)) > 0),
  id_document TEXT,
  email TEXT,
  extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_contacts_owner_captured UNIQUE (owner_id, captured_at),
  CONSTRAINT contacts_extra_fields_is_object CHECK (jsonb_typeof(extra_fields) = 'object'),
  CONSTRAINT contacts_email_format_chk CHECK (
    email IS NULL
    OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);