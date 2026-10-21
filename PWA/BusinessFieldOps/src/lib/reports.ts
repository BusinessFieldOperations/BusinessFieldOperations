import {db, type ReferenceRow} from '@/lib/offline/db';
import {describeDeliveryError} from '@/lib/offline/deliveryErrors';
import {listOutbox} from '@/lib/offline/outbox';
import type {OutboxItem} from '@/lib/offline/types';
import {toPage, type Page, type PageRequest} from '@/lib/pagination';
import type {UserRole} from '@/lib/profiles';
import type {Table} from 'dexie';

export type ReportKind = 'merchant' | 'promoter';

/**
 * - `sent`: the server has it.
 * - `queued`: saved on this device, waiting to be sent.
 * - `failed`: the server refused it for good; needs the user.
 */
export type ReportStatus = 'sent' | 'queued' | 'failed';

export interface ReportListItem {
  /** Server id. `0` for reports that are still in the outbox. */
  id: number;
  kind: ReportKind;
  /** When the server got it (when it was captured, while in the outbox). */
  submitted_at: string;
  salesman_name: string;
  zone: string;
  establishment_id: string;
  client_id: string | null;
  state_id: number | null;
  status: ReportStatus;
  /** The outbox item behind a `queued` or `failed` report. */
  outboxId: string | null;
  /** Why a `failed` report was refused, in words. */
  errorMessage: string | null;
}

export interface CachedReportsPageRequest extends PageRequest {
  userId: string;
  role: UserRole;
  /** Text to look for in salesman name and zone. Empty means no filter. */
  search?: string;
  reporterId?: string | null;
}

type ServerRow =
  ReferenceRow<'merchant_reports'> | ReferenceRow<'promoter_reports'>;

interface Entry {
  item: ReportListItem;
  searchText: string;
  /** Epoch ms of `captured_at`: the same report has the same value in the
   * outbox and in the server's copy. */
  capturedAt: number;
}

const fromServer = (row: ServerRow, kind: ReportKind): Entry => ({
  item: {
    id: row.id,
    kind,
    submitted_at: row.submitted_at,
    salesman_name: row.salesman_name,
    zone: row.zone,
    establishment_id: row.establishment_id,
    client_id: row.client_id,
    state_id: row.state_id,
    status: 'sent',
    outboxId: null,
    errorMessage: null,
  },
  searchText: row.search_text ?? `${row.salesman_name} ${row.zone}`,
  capturedAt: Date.parse(row.captured_at),
});

function reportKindOf(item: OutboxItem): ReportKind | null {
  if (item.kind === 'merchant_report') return 'merchant';
  if (item.kind === 'promoter_report') return 'promoter';

  return null;
}

const fromOutbox = (item: OutboxItem, kind: ReportKind): Entry => {
  const salesmanName = String(item.payload.salesman_name ?? '');
  const zone = String(item.payload.zone ?? '');
  const failed = item.status === 'failed';

  return {
    item: {
      id: 0,
      kind,
      submitted_at: item.capturedAt,
      salesman_name: salesmanName,
      zone,
      establishment_id: String(item.payload.establishment_id ?? ''),
      client_id:
        typeof item.payload.client_id === 'string'
          ? item.payload.client_id
          : null,
      state_id:
        typeof item.payload.state_id === 'number'
          ? item.payload.state_id
          : null,
      status: failed ? 'failed' : 'queued',
      outboxId: item.id,
      errorMessage: failed ? describeDeliveryError(item.lastError) : null,
    },
    searchText: `${salesmanName} ${zone}`,
    capturedAt: Date.parse(item.capturedAt),
  };
};

/**
 * Gets one page of reports from the local copy of the report tables, plus the
 * user's reports that are still in the outbox (queued or failed), newest
 * first.
 *
 * Mirrors the `reports_feed` RLS rules: administrators see all cached rows,
 * while merchants and promoters see only their own.
 */
export async function getCachedReportsPage({
  offset,
  limit,
  userId,
  role,
  search = '',
  reporterId = null,
}: CachedReportsPageRequest): Promise<Page<ReportListItem>> {
  /** All rows of a table, or only those whose indexed `column` is `owner`. */
  function rowsOf<Row>(
    table: Table<Row, IDBValidKey>,
    column: string,
    owner: string | null,
  ): Promise<Row[]> {
    return owner
      ? table.where(column).equals(owner).toArray()
      : table.toArray();
  }

  const isAdmin = role === 'administrator';
  // Administrators read every cached row (or those of one user); everybody
  // else only their own.
  const owner = isAdmin ? reporterId : userId;
  const [merchantRows, promoterRows, outbox] = await Promise.all([
    isAdmin || role === 'merchant'
      ? rowsOf(db.reference('merchant_reports'), 'merchant_id', owner)
      : Promise.resolve([]),
    isAdmin || role === 'promoter'
      ? rowsOf(db.reference('promoter_reports'), 'promoter_id', owner)
      : Promise.resolve([]),
    // Administrators do not create reports, so they have no outbox.
    isAdmin ? Promise.resolve<OutboxItem[]>([]) : listOutbox(userId),
  ]);

  const sent = [
    ...merchantRows.map(row => fromServer(row, 'merchant')),
    ...promoterRows.map(row => fromServer(row, 'promoter')),
  ];
  const sentKeys = new Set(
    sent.map(entry => `${entry.item.kind}|${entry.capturedAt}`),
  );

  const waiting = outbox.flatMap(item => {
    const kind = reportKindOf(item);

    // Not a report, or its report already came back in a sync and the item
    // is about to be removed: never show it twice.
    if (!kind || sentKeys.has(`${kind}|${Date.parse(item.capturedAt)}`)) {
      return [];
    }

    return [fromOutbox(item, kind)];
  });

  const term = search.toLowerCase();
  const items = [...waiting, ...sent]
    .filter(entry => !term || entry.searchText.toLowerCase().includes(term))
    .map(entry => entry.item)
    .sort(
      (first, second) =>
        Date.parse(second.submitted_at) - Date.parse(first.submitted_at) ||
        second.id - first.id ||
        second.kind.localeCompare(first.kind),
    );

  return toPage(items.slice(offset, offset + limit + 1), limit);
}
