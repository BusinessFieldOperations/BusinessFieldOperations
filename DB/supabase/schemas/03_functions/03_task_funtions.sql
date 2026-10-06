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