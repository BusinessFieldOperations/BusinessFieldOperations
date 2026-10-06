CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assigned_to UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  establishment_id UUID NOT NULL REFERENCES public.establishment (id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Completion/verification date. NULL = the task is still active.
  completed_at TIMESTAMPTZ,

  CONSTRAINT chk_tasks_completed_after_assigned
    CHECK (completed_at IS NULL OR completed_at >= assigned_at),

  -- to a task assigned to the reporter AND for the same establishment.
  CONSTRAINT uq_tasks_id_assignee_establishment
    UNIQUE (id, assigned_to, establishment_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_active
  ON public.tasks (assigned_to) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to
  ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_establishment_id
  ON public.tasks (establishment_id);