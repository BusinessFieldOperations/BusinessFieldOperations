CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL,
  -- Whose contact it is (who sees and, if created_by matches, edits it).
  owner_id UUID NOT NULL DEFAULT auth.uid () REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- Who created the row. It differs from owner_id when an administrator
  -- assigned the contact to a user: those rows are read-only for the owner.
  created_by UUID NOT NULL DEFAULT auth.uid () REFERENCES public.profiles (id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL CHECK (length(btrim(first_name)) > 0),
  last_name TEXT NOT NULL CHECK (length(btrim(last_name)) > 0),
  id_document TEXT,
  email TEXT,
  extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- (owner, captured_at) is the idempotency key and also how offline edits
  -- find their contact (a contact created offline has no server id yet).
  CONSTRAINT uq_contacts_owner_captured UNIQUE (owner_id, captured_at),
  CONSTRAINT contacts_extra_fields_is_object CHECK (jsonb_typeof(extra_fields) = 'object'),
  CONSTRAINT contacts_email_format_chk CHECK (
    email IS NULL
    OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

-- Serves the foreign key (deleting a profile checks its contacts).
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON public.contacts (created_by);
