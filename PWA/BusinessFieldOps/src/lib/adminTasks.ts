import {getClientNames} from '@/lib/clients';
import {getEstablishmentInfos} from '@/lib/establishments';
import {db} from '@/lib/offline/db';
import {useLiveQuery} from '@/lib/offline/useLiveQuery';
import {toPage, type Page, type PageRequest} from '@/lib/pagination';
import type {UserRole} from '@/lib/profiles';
import type {ReportKind} from '@/lib/reports';
import {sentReportViewKey} from '@/lib/reportView';
import {normalizeSearchText} from '@/lib/useLocalSearch';

// ----------------------------------------------------------------- state

/**
 * What the admin sees of a task, one state at a time. When several apply the
 * first one wins: completed > reported > new > open.
 *
 * - `completed`: closed by an administrator.
 * - `reported`: at least one report (sent or not) exists for it.
 * - `new`: assigned in the last 24 hours, nothing reported yet.
 * - `open`: none of the above.
 */
export type AdminTaskState = 'completed' | 'reported' | 'new' | 'open';

/** A task counts as new for this long after it is assigned. */
export const NEW_TASK_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getTaskState(
  task: {assignedAt: string; completedAt: string | null; reportCount: number},
  now: number = Date.now(),
): AdminTaskState {
  if (task.completedAt !== null) {
    return 'completed';
  }

  if (task.reportCount > 0) {
    return 'reported';
  }

  return now - Date.parse(task.assignedAt) < NEW_TASK_WINDOW_MS
    ? 'new'
    : 'open';
}

// ----------------------------------------------------------------- model

/**
 * `?adminTask=new`: the form for a new task. Any other value is the id of the
 * task to show.
 */
export const NEW_ADMIN_TASK_KEY = 'new';

/** A task ready to display in the administrator's list. */
export interface AdminTaskItem {
  id: string;
  description: string | null;
  /** ISO-8601, set by the server when the task was created. */
  assignedAt: string;
  /** ISO-8601, `null` while the task is open. */
  completedAt: string | null;
  assigneeId: string;
  /** Empty when the profile is not in the local copy. */
  assigneeName: string;
  assigneeRole: UserRole | null;
  establishmentId: string;
  establishmentName: string;
  location: string;
  stateName: string;
  /** Reports of every user for this task (sent ones: administrators see all). */
  reportCount: number;
  state: AdminTaskState;
}

// --------------------------------------------------------------- helpers

/** Number of reports per task id, from the local copy of both report tables. */
async function countReports(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  // Only the indexed `task_id` values are read, not the rows.
  const [merchantTaskIds, promoterTaskIds] = await Promise.all([
    db.reference('merchant_reports').orderBy('task_id').keys(),
    db.reference('promoter_reports').orderBy('task_id').keys(),
  ]);

  for (const taskId of [...merchantTaskIds, ...promoterTaskIds]) {
    const key = String(taskId);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

/**
 * Every task, newest first, from the local data (works offline), or only the
 * one with `onlyTaskId`. Only administrators call this: RLS gives them every
 * task, so the local copy has them all.
 */
async function loadAdminTasks(onlyTaskId?: string): Promise<AdminTaskItem[]> {
  const [tasks, profiles, reportCounts] = await Promise.all([
    onlyTaskId
      ? db
          .reference('tasks')
          .get(onlyTaskId)
          .then(task => (task ? [task] : []))
      : db.reference('tasks').toArray(),
    db.reference('profiles').toArray(),
    countReports(),
  ]);
  const establishments = await getEstablishmentInfos(
    tasks.map(task => task.establishment_id),
  );
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));
  const now = Date.now();

  return tasks
    .map((task): AdminTaskItem => {
      const assignee = profileById.get(task.assigned_to);
      const establishment = establishments.get(task.establishment_id);
      const reportCount = reportCounts.get(task.id) ?? 0;

      return {
        id: task.id,
        description: task.description,
        assignedAt: task.assigned_at,
        completedAt: task.completed_at,
        assigneeId: task.assigned_to,
        assigneeName: assignee
          ? `${assignee.first_name} ${assignee.last_name}`.trim()
          : '',
        assigneeRole: assignee?.role ?? null,
        establishmentId: task.establishment_id,
        establishmentName: establishment?.name ?? '—',
        location: establishment?.location ?? '',
        stateName: establishment?.stateName ?? '',
        reportCount,
        state: getTaskState(
          {
            assignedAt: task.assigned_at,
            completedAt: task.completed_at,
            reportCount,
          },
          now,
        ),
      };
    })
    .sort(
      (first, second) =>
        Date.parse(second.assignedAt) - Date.parse(first.assignedAt) ||
        first.id.localeCompare(second.id),
    );
}

/** Start of a `yyyy-mm-dd` day in the device's time zone, in epoch ms. */
function startOfDay(value: string): number | null {
  const time = new Date(`${value}T00:00:00`).getTime();

  return Number.isNaN(time) ? null : time;
}

/** Last millisecond of a `yyyy-mm-dd` day in the device's time zone. */
function endOfDay(value: string): number | null {
  const time = new Date(`${value}T23:59:59.999`).getTime();

  return Number.isNaN(time) ? null : time;
}

// ------------------------------------------------------------------ list

/** `''` shows every task. */
export type AdminTaskStatusFilter = '' | 'completed' | 'uncompleted';

/** Filters of the administrator's task list. Empty values filter nothing. */
export interface AdminTaskFilters {
  /**
   * Text to look for in establishment, place, state, description and the
   * assignee's name. Every word must match, accents and case are ignored.
   */
  search?: string;
  /** Only the tasks of this user. */
  assigneeId?: string | null;
  /** Completed or not, whatever their other state. */
  status?: AdminTaskStatusFilter;
  /** `yyyy-mm-dd`: tasks assigned on or after this day (device time zone). */
  from?: string;
  /** `yyyy-mm-dd`: tasks assigned on or before this day (device time zone). */
  to?: string;
}

export interface AdminTasksPageRequest extends PageRequest, AdminTaskFilters {}

function matchesFilters(
  task: AdminTaskItem,
  {search = '', assigneeId = null, status = '', from, to}: AdminTaskFilters,
): boolean {
  if (assigneeId && task.assigneeId !== assigneeId) {
    return false;
  }

  if (status === 'completed' && task.completedAt === null) {
    return false;
  }

  if (status === 'uncompleted' && task.completedAt !== null) {
    return false;
  }

  const assignedAt = Date.parse(task.assignedAt);
  const start = from ? startOfDay(from) : null;
  const end = to ? endOfDay(to) : null;

  if (
    (start !== null && assignedAt < start) ||
    (end !== null && assignedAt > end)
  ) {
    return false;
  }

  const words = normalizeSearchText(search.trim()).split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return true;
  }

  const haystack = normalizeSearchText(
    [
      task.establishmentName,
      task.location,
      task.stateName,
      task.description,
      task.assigneeName,
    ]
      .filter(Boolean)
      .join(' '),
  );

  return words.every(word => haystack.includes(word));
}

/** One page of the administrator's tasks, newest first, with the filters. */
export async function getCachedAdminTasksPage({
  offset,
  limit,
  search,
  assigneeId,
  status,
  from,
  to,
}: AdminTasksPageRequest): Promise<Page<AdminTaskItem>> {
  const tasks = await loadAdminTasks();
  const matching = tasks.filter(task =>
    matchesFilters(task, {search, assigneeId, status, from, to}),
  );

  return toPage(matching.slice(offset, offset + limit + 1), limit);
}

// ---------------------------------------------------------------- detail

/** A report of a task, as a row of the task's detail. */
export interface AdminTaskReport {
  kind: ReportKind;
  salesmanName: string;
  zone: string;
  /** Empty when the client is not in the local copy. */
  clientName: string;
  /** ISO-8601 time the report was captured on the device. */
  capturedAt: string;
  /** `?view=<key>` opens it (see `reportView.ts`). */
  viewKey: string;
}

/** One task with every report made for it, newest first. */
export interface AdminTaskDetail extends AdminTaskItem {
  reports: AdminTaskReport[];
}

/**
 * One task and its reports, from the local data. `null` if the task is not
 * there. Administrators have no outbox, so every report is a sent one.
 */
export async function loadAdminTaskDetail(
  taskId: string,
): Promise<AdminTaskDetail | null> {
  const [task] = await loadAdminTasks(taskId);

  if (!task) {
    return null;
  }

  const [merchantRows, promoterRows, clientNames] = await Promise.all([
    db.reference('merchant_reports').where('task_id').equals(taskId).toArray(),
    db.reference('promoter_reports').where('task_id').equals(taskId).toArray(),
    getClientNames(),
  ]);

  const toReport = (
    row: {
      id: number;
      captured_at: string;
      salesman_name: string;
      zone: string;
      client_id: string | null;
    },
    kind: ReportKind,
  ): AdminTaskReport => ({
    kind,
    salesmanName: row.salesman_name,
    zone: row.zone,
    clientName: row.client_id ? (clientNames.get(row.client_id) ?? '') : '',
    capturedAt: row.captured_at,
    viewKey: sentReportViewKey(kind, row.id),
  });

  const reports = [
    ...merchantRows.map(row => toReport(row, 'merchant')),
    ...promoterRows.map(row => toReport(row, 'promoter')),
  ].sort(
    (first, second) =>
      Date.parse(second.capturedAt) - Date.parse(first.capturedAt),
  );

  return {...task, reports};
}

/**
 * The task behind `?adminTask=<id>`. `undefined` while loading, `null` if it
 * is not there. Follows the local data: completing or reopening it, or a sync
 * bringing a new report, updates the dialog by itself.
 */
export function useAdminTaskDetail(
  taskId: string,
): AdminTaskDetail | null | undefined {
  return useLiveQuery(() => loadAdminTaskDetail(taskId), [taskId]);
}
