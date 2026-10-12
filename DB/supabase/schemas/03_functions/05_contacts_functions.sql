-- Atomic + idempotent contact submission.
-- The client must resend the same captured_at value on every retry.
-- Payload: {"captured_at": "2026-10-12T15:04:05.123Z", "first_name": "...",
--           "last_name": "...", "id_document": "...", "email": "...",
--           "extra_fields": {}}
-- Ownership is derived from auth.uid(); RLS remains in force.
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

  -- owner_id is not supplied: its DEFAULT auth.uid() applies.
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