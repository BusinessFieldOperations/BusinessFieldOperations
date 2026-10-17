-- Atomic + idempotent contact submission.
-- The client must resend the same captured_at value on every retry.
-- Payload: {"captured_at": "2026-10-12T15:04:05.123Z", "first_name": "...",
--           "last_name": "...", "id_document": "...", "email": "...",
--           "extra_fields": {}}
-- Ownership is derived from auth.uid() (owner_id and created_by both take
-- their DEFAULT); RLS remains in force.
CREATE OR REPLACE FUNCTION public.submit_contact(p_contact jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_captured_at TIMESTAMPTZ;
  v_contact_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  v_captured_at := (p_contact ->> 'captured_at')::timestamptz;

  IF v_captured_at IS NULL THEN
    RAISE EXCEPTION 'captured_at is required'
      USING ERRCODE = '22023';
  END IF;

  -- Recognize a retry before inserting, so it remains valid after any later changes.
  SELECT c.id INTO v_contact_id
  FROM public.contacts AS c
  WHERE c.owner_id = v_user_id
    AND c.captured_at = v_captured_at;

  IF FOUND THEN
    RETURN jsonb_build_object('id', v_contact_id, 'created', false);
  END IF;

  -- owner_id and created_by are not supplied: their DEFAULT auth.uid() applies.
  INSERT INTO public.contacts (
    captured_at, first_name, last_name, id_document, email, extra_fields
  )
  SELECT
    c.captured_at, c.first_name, c.last_name, c.id_document, c.email,
    COALESCE(c.extra_fields, '{}'::jsonb)
  FROM jsonb_to_record(p_contact) AS c (
    captured_at timestamptz, first_name text, last_name text,
    id_document text, email text, extra_fields jsonb
  )
  ON CONFLICT (owner_id, captured_at) DO NOTHING
  RETURNING id INTO v_contact_id;

  -- Another request may have inserted the same contact concurrently.
  IF v_contact_id IS NULL THEN
    SELECT c.id INTO v_contact_id
    FROM public.contacts AS c
    WHERE c.owner_id = v_user_id
      AND c.captured_at = v_captured_at;

    RETURN jsonb_build_object('id', v_contact_id, 'created', false);
  END IF;

  RETURN jsonb_build_object('id', v_contact_id, 'created', true);
END;
$$;

-- Edit of one of the caller's OWN contacts, safe to send from the offline
-- outbox. The contact is found by (auth.uid(), contact_captured_at) and not by
-- id, because a contact created offline has no server id yet.
-- The editable fields are replaced as a whole, so the client always sends all
-- of them; sending the same payload twice leaves the same result (idempotent).
-- Payload: {"contact_captured_at": "2026-10-12T15:04:05.123Z",
--           "first_name": "...", "last_name": "...", "id_document": "...",
--           "email": "...", "extra_fields": {}}
-- (The key is not "captured_at" on purpose: the outbox overwrites that one
-- with the moment of the edit.)
--
-- Errors the client should treat as final ("failed", do not retry):
--   P0001 / message 'contact_not_found'     no such contact for this user
--   P0001 / message 'contact_not_editable'  assigned by an administrator
--   23502 / 23514 / 22xxx / 42501           invalid data or not allowed
CREATE OR REPLACE FUNCTION public.update_contact(p_contact jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_captured_at TIMESTAMPTZ;
  v_contact_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  v_captured_at := (p_contact ->> 'contact_captured_at')::timestamptz;

  IF v_captured_at IS NULL THEN
    RAISE EXCEPTION 'contact_captured_at is required'
      USING ERRCODE = '22023';
  END IF;

  -- RLS decides whether the row can be edited: contacts assigned by an
  -- administrator are invisible to this UPDATE for a regular user.
  UPDATE public.contacts AS c
  SET first_name = u.first_name,
      last_name = u.last_name,
      id_document = u.id_document,
      email = u.email,
      extra_fields = COALESCE(u.extra_fields, '{}'::jsonb)
  FROM jsonb_to_record(p_contact) AS u (
    first_name text, last_name text, id_document text, email text,
    extra_fields jsonb
  )
  WHERE c.owner_id = v_user_id
    AND c.captured_at = v_captured_at
  RETURNING c.id INTO v_contact_id;

  IF FOUND THEN
    RETURN jsonb_build_object('id', v_contact_id, 'updated', true);
  END IF;

  -- Nothing was updated: tell "it is not yours to edit" from "it is not there".
  IF EXISTS (
    SELECT 1
    FROM public.contacts AS c
    WHERE c.owner_id = v_user_id
      AND c.captured_at = v_captured_at
  ) THEN
    RAISE EXCEPTION 'contact_not_editable'
      USING ERRCODE = 'P0001',
            DETAIL = 'this contact was assigned to you and only an administrator can edit it';
  END IF;

  RAISE EXCEPTION 'contact_not_found'
    USING ERRCODE = 'P0001',
          DETAIL = format('no contact of yours was captured at %s', v_captured_at);
END;
$$;

-- Administrators only: creates the same contact for one or several users, one
-- row per recipient (owner_id = the recipient, created_by = the administrator).
-- Each copy is independent afterwards. A regular user cannot edit them.
-- Idempotent: the same captured_at can be sent again, recipients that already
-- have that contact are skipped. (A recipient who happened to capture a
-- contact at the very same millisecond is skipped as well.)
-- Payload p_contact: same as submit_contact. p_owner_ids: profile ids.
-- Returns {"created": n, "skipped": m}.
--
-- Errors (all final): 42501 'not_allowed', P0001 'unknown_recipient',
-- 22023 'no_recipients' / missing captured_at.
CREATE OR REPLACE FUNCTION public.assign_contact(
  p_contact jsonb,
  p_owner_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_captured_at TIMESTAMPTZ;
  v_owner_ids UUID[];
  v_created INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  v_captured_at := (p_contact ->> 'captured_at')::timestamptz;

  IF v_captured_at IS NULL THEN
    RAISE EXCEPTION 'captured_at is required'
      USING ERRCODE = '22023';
  END IF;

  -- Without duplicates or NULLs.
  v_owner_ids := ARRAY(
    SELECT DISTINCT o
    FROM unnest(COALESCE(p_owner_ids, '{}'::uuid[])) AS o
    WHERE o IS NOT NULL
  );

  IF cardinality(v_owner_ids) = 0 THEN
    RAISE EXCEPTION 'no_recipients' USING ERRCODE = '22023';
  END IF;

  -- Every recipient must be an existing, active profile.
  IF EXISTS (
    SELECT 1
    FROM unnest(v_owner_ids) AS o
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = o
        AND p.is_active
    )
  ) THEN
    RAISE EXCEPTION 'unknown_recipient' USING ERRCODE = 'P0001';
  END IF;

  -- created_by is not supplied: its DEFAULT auth.uid() is the administrator.
  INSERT INTO public.contacts (
    captured_at, owner_id, first_name, last_name, id_document, email,
    extra_fields
  )
  SELECT
    c.captured_at, o.owner_id, c.first_name, c.last_name, c.id_document,
    c.email, COALESCE(c.extra_fields, '{}'::jsonb)
  FROM jsonb_to_record(p_contact) AS c (
    captured_at timestamptz, first_name text, last_name text,
    id_document text, email text, extra_fields jsonb
  )
  CROSS JOIN unnest(v_owner_ids) AS o (owner_id)
  ON CONFLICT (owner_id, captured_at) DO NOTHING;

  GET DIAGNOSTICS v_created = ROW_COUNT;

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', cardinality(v_owner_ids) - v_created
  );
END;
$$;
