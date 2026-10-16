import {getClientNames} from '@/lib/clients';
import {
  db,
  listDrafts,
  listOutbox,
  useLiveQuery,
  type Draft,
  type ReferenceRow,
} from '@/lib/offline';
import type {UserRole} from '@/lib/profiles';
import {OFFLINE_KIND, reportKindForRole} from '@/lib/reportKinds';
import type {ReportKind} from '@/lib/reports';

/**
 * - `sent`: the server has it.
 * - `queued`: saved on this device, waiting to be sent.
 * - `failed`: the server rejected it for good; needs the user.
 */
export type TaskReportStatus = 'sent' | 'queued' | 'failed';

/** A report of a task, wherever it currently lives. */
export interface TaskReportEntry {
  key: string;
  status: TaskReportStatus;
  /** ISO-8601 time the report was captured on the device. */
  capturedAt: string;
  salesmanName: string;
  zone: string;
  clientId: string | null;
  clientName: string;
}

/** An open task of the signed-in user, ready to display. */
export interface TaskListItem {
  id: string;
  description: string | null;
  assignedAt: string;
  establishmentId: string;
  stateId: number | null;
  /** Legal name plus branch, e.g. "Acme - Downtown". */
  establishmentName: string;
  location: string;
  stateName: string;
  /** Every report of the task, newest first (failed ones included). */
  reports: readonly TaskReportEntry[];
  /** Reports sent or waiting to be sent: what the badge shows. */
  reportCount: number;
  /** Drafts of this task, most recently edited first. */
  drafts: readonly Draft[];
}

/**
 * Reports of the given tasks, grouped by task id, newest first.
 *
 * Merges the local copy of the server's reports with the outbox. An outbox
 * item whose report already came back in a sync is skipped (same task and
 * `captured_at`), so a report is never counted twice while the sender is
 * about to remove it.
 */
export async function getTaskReports(
  userId: string,
  kind: ReportKind,
  taskIds: readonly string[],
): Promise<Map<string, TaskReportEntry[]>> {
  const wanted = new Set(taskIds);
  const table = kind === 'merchant' ? 'merchant_reports' : 'promoter_reports';

  const [rows, outbox, clientNames] = await Promise.all([
    db
      .reference(table)
      .where('task_id')
      .anyOf([...wanted])
      .toArray(),
    listOutbox(userId),
    getClientNames(),
  ]);

  const nameOf = (clientId: string | null) =>
    clientId ? (clientNames.get(clientId) ?? '') : '';
  const result = new Map<string, TaskReportEntry[]>();
  const add = (taskId: string, entry: TaskReportEntry) => {
    const entries = result.get(taskId);

    if (entries) {
      entries.push(entry);
    } else {
      result.set(taskId, [entry]);
    }
  };

  const sentKeys = new Set<string>();

  for (const row of rows) {
    sentKeys.add(`${row.task_id}|${Date.parse(row.captured_at)}`);
    add(row.task_id, {
      key: `sent-${row.id}`,
      status: 'sent',
      capturedAt: row.captured_at,
      salesmanName: row.salesman_name,
      zone: row.zone,
      clientId: row.client_id,
      clientName: nameOf(row.client_id),
    });
  }

  for (const item of outbox) {
    const taskId = item.payload.task_id;

    if (
      item.kind !== OFFLINE_KIND[kind] ||
      typeof taskId !== 'string' ||
      !wanted.has(taskId) ||
      sentKeys.has(`${taskId}|${Date.parse(item.capturedAt)}`)
    ) {
      continue;
    }

    const clientId =
      typeof item.payload.client_id === 'string'
        ? item.payload.client_id
        : null;

    add(taskId, {
      key: `outbox-${item.id}`,
      status: item.status === 'failed' ? 'failed' : 'queued',
      capturedAt: item.capturedAt,
      salesmanName: String(item.payload.salesman_name ?? ''),
      zone: String(item.payload.zone ?? ''),
      clientId,
      clientName: nameOf(clientId),
    });
  }

  for (const entries of result.values()) {
    entries.sort(
      (first, second) =>
        Date.parse(second.capturedAt) - Date.parse(first.capturedAt),
    );
  }

  return result;
}

/**
 * Open tasks (not closed by an administrator) assigned to the user, newest
 * first, built from the local copy so it works offline.
 */
export async function getAvailableTasks(
  userId: string,
  kind: ReportKind,
): Promise<TaskListItem[]> {
  const assigned = await db
    .reference('tasks')
    .where('assigned_to')
    .equals(userId)
    .toArray();
  // IndexedDB cannot index null, so "not closed" is filtered here.
  const open = assigned.filter(task => task.completed_at === null);

  if (open.length === 0) {
    return [];
  }

  const [establishments, states, reportsByTask, drafts] = await Promise.all([
    db
      .reference('establishment')
      .bulkGet([...new Set(open.map(task => task.establishment_id))]),
    db.reference('states').toArray(),
    getTaskReports(
      userId,
      kind,
      open.map(task => task.id),
    ),
    listDrafts(userId, OFFLINE_KIND[kind]),
  ]);

  const establishmentById = new Map<string, ReferenceRow<'establishment'>>();

  for (const establishment of establishments) {
    if (establishment) {
      establishmentById.set(establishment.id, establishment);
    }
  }

  const identities = await db
    .reference('legal_identity')
    .bulkGet([
      ...new Set(
        [...establishmentById.values()].map(item => item.legal_identity_id),
      ),
    ]);
  const identityNameById = new Map<string, string>();

  for (const identity of identities) {
    if (identity) {
      identityNameById.set(identity.id, identity.name);
    }
  }

  const stateNameById = new Map(states.map(state => [state.id, state.name]));

  return open
    .map((task): TaskListItem => {
      const establishment = establishmentById.get(task.establishment_id);
      const reports = reportsByTask.get(task.id) ?? [];

      return {
        id: task.id,
        description: task.description,
        assignedAt: task.assigned_at,
        establishmentId: task.establishment_id,
        stateId: establishment?.state_id ?? null,
        establishmentName:
          [
            establishment
              ? identityNameById.get(establishment.legal_identity_id)
              : undefined,
            establishment?.branch_name,
          ]
            .filter(Boolean)
            .join(' - ') || '—',
        location: establishment?.location ?? '',
        stateName: establishment
          ? (stateNameById.get(establishment.state_id) ?? '')
          : '',
        reports,
        reportCount: reports.filter(report => report.status !== 'failed')
          .length,
        drafts: drafts.filter(draft => draft.refId === task.id),
      };
    })
    .sort((first, second) => second.assignedAt.localeCompare(first.assignedAt));
}

/**
 * Open tasks of the signed-in user. `undefined` until the first read ends;
 * updates by itself when the sync, a draft or the outbox change something.
 * Administrators get an empty list: they do not create reports.
 */
export function useAvailableTasks(
  userId: string | undefined,
  role: UserRole | undefined,
): TaskListItem[] | undefined {
  const kind = reportKindForRole(role);

  return useLiveQuery(
    async () => (userId && kind ? getAvailableTasks(userId, kind) : []),
    [userId, kind],
  );
}
