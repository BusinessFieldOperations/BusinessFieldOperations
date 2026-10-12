-- Atomic + idempotent report submission.
--
-- Pattern (reuse it for contacts, etc.):
--   1. Require an authenticated user.
--   2. Read the idempotency key (captured_at) and the parent references.
--   3. If (owner, captured_at) already exists, return it: this is a retry.
--      This runs BEFORE any insert on purpose: the insert policies require the
--      task to be open, and the first successful insert may have completed it,
--      so re-inserting would be rejected instead of recognised as a retry.
--   4. Check business preconditions with a clear, machine-readable error.
--   5. Insert parent + children in this single statement (one transaction):
--      either everything is stored or nothing is.
--   6. Return {id, created}.
--
-- SECURITY INVOKER keeps RLS in force: the owner comes from auth.uid() (the
-- client can never choose it) and the existing insert policies still apply.
--
-- Payload for submit_merchant_report (captured_at is an ISO-8601 string with
-- milliseconds; the client must resend the exact same value on every retry):
-- {
--   "captured_at": "2026-10-12T15:04:05.123Z",
--   "task_id": "<uuid>", "state_id": 1, "client_id": "<uuid>",
--   "salesman_name": "...", "zone": "...", "establishment_id": "<uuid>",
--   "latitude": 10.5, "longitude": -66.9, "location_accuracy_m": 12.5,
--   "observations": "...", "no_inventory": false,
--   "salesfloors": ["Sala 1", "Sala 2"],
--   "inventory": [
--     {"product_id": "<uuid>", "salesfloor": "Sala 1" | null,
--      "good_units": 3, "damaged_units": 0, "expired_units": 1}
--   ]
-- }
-- Inventory rows point to a salesfloor by NAME because the client cannot know
-- the ids the server will generate.
--
-- Payload for submit_promoter_report: same header fields (without
-- observations / no_inventory / salesfloors / inventory) plus
--   "details": [{"product_id": "<uuid>", "initial_inventory": 10,
--                "final_inventory": 4, "restocked_units": 2}]
--
-- Errors the client should treat as final ("failed", do not retry):
--   P0001 / message 'task_unavailable'   task completed, reassigned or gone
--   P0001 / message 'unknown_salesfloor' inventory points to a missing floor
--   23502 / 23503 / 23505 / 23514 / 22xxx / 42501   invalid data or not allowed
-- Anything else (network, 5xx, expired session) is retryable.

CREATE OR REPLACE FUNCTION public.submit_merchant_report(p_report jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_captured_at TIMESTAMPTZ;
  v_task_id UUID;
  v_report_id INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  v_captured_at := (p_report ->> 'captured_at')::timestamptz;
  v_task_id := (p_report ->> 'task_id')::uuid;

  IF v_captured_at IS NULL OR v_task_id IS NULL THEN
    RAISE EXCEPTION 'captured_at and task_id are required'
      USING ERRCODE = '22023';
  END IF;

  -- Retry of a report that was already received.
  SELECT r.id INTO v_report_id
  FROM public.merchant_reports AS r
  WHERE r.merchant_id = v_user_id
    AND r.captured_at = v_captured_at;

  IF FOUND THEN
    RETURN jsonb_build_object('id', v_report_id, 'created', false);
  END IF;

  -- Same condition as the insert policy, but with a readable error.
  IF NOT EXISTS (
    SELECT 1
    FROM public.tasks AS t
    WHERE t.id = v_task_id
      AND t.assigned_to = v_user_id
      AND t.completed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'task_unavailable'
      USING ERRCODE = 'P0001',
            DETAIL = format('task %s is not assigned to you, is completed or does not exist', v_task_id);
  END IF;

  -- merchant_id is not inserted: its DEFAULT auth.uid() applies.
  INSERT INTO public.merchant_reports (
    captured_at, task_id, state_id, client_id, salesman_name, zone,
    establishment_id, latitude, longitude, location_accuracy_m,
    observations, no_inventory
  )
  SELECT
    r.captured_at, r.task_id, r.state_id, r.client_id, r.salesman_name,
    r.zone, r.establishment_id, r.latitude, r.longitude,
    r.location_accuracy_m, r.observations, COALESCE(r.no_inventory, FALSE)
  FROM jsonb_to_record(p_report) AS r (
    captured_at timestamptz, task_id uuid, state_id integer,
    client_id uuid, salesman_name text, zone text, establishment_id uuid,
    latitude double precision, longitude double precision,
    location_accuracy_m real, observations text, no_inventory boolean
  )
  ON CONFLICT (merchant_id, captured_at) DO NOTHING
  RETURNING id INTO v_report_id;

  -- Lost a race against a concurrent retry of the same report.
  IF v_report_id IS NULL THEN
    SELECT r.id INTO v_report_id
    FROM public.merchant_reports AS r
    WHERE r.merchant_id = v_user_id
      AND r.captured_at = v_captured_at;

    RETURN jsonb_build_object('id', v_report_id, 'created', false);
  END IF;

  INSERT INTO public.merchant_report_salesfloors (report_id, name)
  SELECT DISTINCT v_report_id, btrim(s.value)
  FROM jsonb_array_elements_text(
    COALESCE(p_report -> 'salesfloors', '[]'::jsonb)
  ) AS s (value);

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(
      COALESCE(p_report -> 'inventory', '[]'::jsonb)
    ) AS i (salesfloor text)
    WHERE NULLIF(btrim(i.salesfloor), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.merchant_report_salesfloors AS sf
        WHERE sf.report_id = v_report_id
          AND sf.name = btrim(i.salesfloor)
      )
  ) THEN
    RAISE EXCEPTION 'unknown_salesfloor' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.merchant_report_inventory (
    report_id, product_id, salesfloor_id,
    good_units, damaged_units, expired_units
  )
  SELECT
    v_report_id, i.product_id, sf.id,
    COALESCE(i.good_units, 0),
    COALESCE(i.damaged_units, 0),
    COALESCE(i.expired_units, 0)
  FROM jsonb_to_recordset(
    COALESCE(p_report -> 'inventory', '[]'::jsonb)
  ) AS i (
    product_id uuid, salesfloor text,
    good_units integer, damaged_units integer, expired_units integer
  )
  LEFT JOIN public.merchant_report_salesfloors AS sf
    ON sf.report_id = v_report_id
   AND sf.name = NULLIF(btrim(i.salesfloor), '');

  RETURN jsonb_build_object('id', v_report_id, 'created', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_promoter_report(p_report jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_captured_at TIMESTAMPTZ;
  v_task_id UUID;
  v_report_id INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  v_captured_at := (p_report ->> 'captured_at')::timestamptz;
  v_task_id := (p_report ->> 'task_id')::uuid;

  IF v_captured_at IS NULL OR v_task_id IS NULL THEN
    RAISE EXCEPTION 'captured_at and task_id are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT r.id INTO v_report_id
  FROM public.promoter_reports AS r
  WHERE r.promoter_id = v_user_id
    AND r.captured_at = v_captured_at;

  IF FOUND THEN
    RETURN jsonb_build_object('id', v_report_id, 'created', false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tasks AS t
    WHERE t.id = v_task_id
      AND t.assigned_to = v_user_id
      AND t.completed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'task_unavailable'
      USING ERRCODE = 'P0001',
            DETAIL = format('task %s is not assigned to you, is completed or does not exist', v_task_id);
  END IF;

  -- promoter_id is not inserted: its DEFAULT auth.uid() applies.
  INSERT INTO public.promoter_reports (
    captured_at, task_id, state_id, client_id, salesman_name, zone,
    establishment_id, latitude, longitude, location_accuracy_m
  )
  SELECT
    r.captured_at, r.task_id, r.state_id, r.client_id, r.salesman_name,
    r.zone, r.establishment_id, r.latitude, r.longitude,
    r.location_accuracy_m
  FROM jsonb_to_record(p_report) AS r (
    captured_at timestamptz, task_id uuid, state_id integer,
    client_id uuid, salesman_name text, zone text, establishment_id uuid,
    latitude double precision, longitude double precision,
    location_accuracy_m real
  )
  ON CONFLICT (promoter_id, captured_at) DO NOTHING
  RETURNING id INTO v_report_id;

  IF v_report_id IS NULL THEN
    SELECT r.id INTO v_report_id
    FROM public.promoter_reports AS r
    WHERE r.promoter_id = v_user_id
      AND r.captured_at = v_captured_at;

    RETURN jsonb_build_object('id', v_report_id, 'created', false);
  END IF;

  INSERT INTO public.promoter_report_details (
    report_id, product_id, initial_inventory, final_inventory,
    restocked_units
  )
  SELECT
    v_report_id, d.product_id, d.initial_inventory, d.final_inventory,
    COALESCE(d.restocked_units, 0)
  FROM jsonb_to_recordset(
    COALESCE(p_report -> 'details', '[]'::jsonb)
  ) AS d (
    product_id uuid, initial_inventory integer,
    final_inventory integer, restocked_units integer
  );

  RETURN jsonb_build_object('id', v_report_id, 'created', true);
END;
$$;
