-- Tasks can only be assigned to merchants or promoters (a CHECK cannot look at
-- another table, so it is a trigger; it also covers writes made with service_role).
CREATE OR REPLACE FUNCTION private.validate_task_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = NEW.assigned_to
      AND p.role IN ('merchant', 'promoter')
  ) THEN
    RAISE EXCEPTION 'Tasks can only be assigned to merchant or promoter users'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.validate_task_assignee() FROM PUBLIC, anon, authenticated;

-- Administrators only: marks a task as completed, or reopens it.
--
-- completed_at is stamped here with the SERVER clock: a device with a slow
-- clock could otherwise send a value earlier than assigned_at and break
-- chk_tasks_completed_after_assigned.
--
-- Idempotent: completing a task that is already completed keeps its original
-- completed_at; reopening an open task changes nothing.
--
-- SECURITY INVOKER keeps RLS in force (tasks_admin_all). The explicit
-- is_admin() check is only there to raise a readable error instead of
-- silently updating zero rows.
--
-- Payload: p_task_id (uuid), p_completed (true = complete, false = reopen).
-- Returns {"id": "<uuid>", "completed_at": "<timestamptz>" | null}.
--
-- Errors (all final, the client must not retry):
--   42501 / message 'not_allowed'       the caller is not an administrator
--   P0001 / message 'task_not_found'    no such task
--   22023                               task id or completed flag missing
-- Anything else (network, 5xx, expired session) is retryable.
CREATE OR REPLACE FUNCTION public.set_task_completed(
  p_task_id uuid,
  p_completed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_completed_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_task_id IS NULL OR p_completed IS NULL THEN
    RAISE EXCEPTION 'task_id and completed are required'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.tasks AS t
  SET completed_at = CASE
    WHEN p_completed THEN COALESCE(t.completed_at, CURRENT_TIMESTAMP)
    ELSE NULL
  END
  WHERE t.id = p_task_id
  RETURNING t.completed_at INTO v_completed_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found'
      USING ERRCODE = 'P0001',
            DETAIL = format('task %s does not exist', p_task_id);
  END IF;

  RETURN jsonb_build_object('id', p_task_id, 'completed_at', v_completed_at);
END;
$$;
