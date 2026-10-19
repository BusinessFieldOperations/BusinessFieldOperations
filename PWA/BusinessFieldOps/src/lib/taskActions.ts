import type {Json} from '@/lib/database.types';
import {db} from '@/lib/offline/db';
import {supabase} from '@/lib/supabase';

/** The action goes straight to the server and there is no connection. */
export class TaskNeedsConnectionError extends Error {
  constructor() {
    super('task_needs_connection');
    this.name = 'TaskNeedsConnectionError';
  }
}

/** The task does not exist (anymore) on the server. */
export class TaskNotFoundError extends Error {
  constructor() {
    super('task_not_found');
    this.name = 'TaskNotFoundError';
  }
}

/**
 * Turns a failed request into the right error. supabase-js reports a lost
 * connection with an empty code; everything else is the server's answer.
 */
function failure(error: {code?: string | null; message: string}): unknown {
  if (!error.code) {
    return new TaskNeedsConnectionError();
  }

  if (error.message === 'task_not_found') {
    return new TaskNotFoundError();
  }

  return error;
}

// -------------------------------------------------------------- creating

/** One task to create: its id is fixed by the client (see below). */
export interface TaskAssignment {
  id: string;
  assigneeId: string;
}

/**
 * Gives every assignee a task id and remembers it in `known`. Keep `known`
 * for as long as the form is open and resend it on every attempt: the id is
 * the idempotency key, so a retry after a lost answer never creates the task
 * twice. Assignees removed from the form keep their entry, which is harmless.
 */
export function assignTaskIds(
  assigneeIds: readonly string[],
  known: Map<string, string>,
): TaskAssignment[] {
  return assigneeIds.map(assigneeId => {
    let id = known.get(assigneeId);

    if (!id) {
      id = crypto.randomUUID();
      known.set(assigneeId, id);
    }

    return {id, assigneeId};
  });
}

/** Input of {@link createTasks}. */
export interface CreateTasksInput {
  establishmentId: string;
  /** Blank is stored as no description. */
  description: string;
  /** One task per assignee (merchants or promoters; the server checks it). */
  assignments: readonly TaskAssignment[];
}

export interface CreateTasksResult {
  /** Tasks created now. */
  created: number;
  /** Tasks that already existed (a retry). */
  skipped: number;
}

/**
 * Administrators only (RLS decides): creates the same task for one or several
 * users, one independent task each, in a single request (all or none). It
 * needs a connection, so it does not use the outbox.
 *
 * The local copy gets the new rows right away, so the list shows them without
 * waiting for the next sync.
 */
export async function createTasks({
  establishmentId,
  description,
  assignments,
}: CreateTasksInput): Promise<CreateTasksResult> {
  if (!navigator.onLine) {
    throw new TaskNeedsConnectionError();
  }

  const rows = assignments.map(assignment => ({
    id: assignment.id,
    assigned_to: assignment.assigneeId,
    establishment_id: establishmentId,
    description: description.trim() || null,
  }));

  // ON CONFLICT DO NOTHING: a task that already exists is left alone, and
  // only the rows created now come back.
  const {data, error} = await supabase
    .from('tasks')
    .upsert(rows, {onConflict: 'id', ignoreDuplicates: true})
    .select();

  if (error) {
    throw failure(error);
  }

  const created = data ?? [];
  let stored = created;

  // A retry: bring the copies that were created the first time too.
  if (created.length < rows.length) {
    const createdIds = new Set(created.map(task => task.id));
    const {data: existing, error: fetchError} = await supabase
      .from('tasks')
      .select('*')
      .in(
        'id',
        rows.map(row => row.id).filter(id => !createdIds.has(id)),
      );

    if (fetchError) {
      // The tasks exist: the next sync brings them, no need to fail.
      console.warn('Could not fetch the existing tasks', fetchError);
    } else {
      stored = [...created, ...(existing ?? [])];
    }
  }

  try {
    await db.reference('tasks').bulkPut(stored);
  } catch (cause) {
    console.warn('Could not store the new tasks locally', cause);
  }

  return {created: created.length, skipped: rows.length - created.length};
}

// ------------------------------------------------------------- completing

function parseCompletedAt(data: Json | null): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }

  return typeof data.completed_at === 'string' ? data.completed_at : null;
}

/**
 * Administrators only: marks a task as completed (`true`) or reopens it
 * (`false`). The server stamps `completed_at` with its own clock. Needs a
 * connection.
 *
 * Resolves with the new `completed_at` (`null` when reopened) and updates the
 * local copy, so lists and dialogs change at once.
 */
export async function setTaskCompleted(
  taskId: string,
  completed: boolean,
): Promise<string | null> {
  if (!navigator.onLine) {
    throw new TaskNeedsConnectionError();
  }

  const {data, error} = await supabase.rpc('set_task_completed', {
    p_task_id: taskId,
    p_completed: completed,
  });

  if (error) {
    throw failure(error);
  }

  const completedAt = parseCompletedAt(data);

  await db.reference('tasks').update(taskId, {completed_at: completedAt});

  return completedAt;
}
