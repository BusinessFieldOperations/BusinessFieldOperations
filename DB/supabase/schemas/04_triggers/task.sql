CREATE OR REPLACE TRIGGER validate_task_assignee
BEFORE INSERT OR UPDATE OF assigned_to ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION private.validate_task_assignee();