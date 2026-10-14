import {toPage, type Page, type PageRequest} from '@/lib/pagination';
import type {UserRole} from '@/lib/profiles';
import {db} from '@/lib/offline/db';

export type ReportKind = 'merchant' | 'promoter';

export interface ReportListItem {
  id: number;
  kind: ReportKind;
  submitted_at: string;
  salesman_name: string;
  zone: string;
  establishment_id: string;
  client_id: string | null;
  state_id: number | null;
}

export interface CachedReportsPageRequest extends PageRequest {
  userId: string;
  role: UserRole;
  /** Text to look for in salesman name and zone. Empty means no filter. */
  search?: string;
}

/**
 * Gets one page of reports from the local copy of the report tables.
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
}: CachedReportsPageRequest): Promise<Page<ReportListItem>> {
  const [merchantRows, promoterRows] = await Promise.all([
    role === 'administrator'
      ? db.reference('merchant_reports').toArray()
      : role === 'merchant'
        ? db
            .reference('merchant_reports')
            .where('merchant_id')
            .equals(userId)
            .toArray()
        : Promise.resolve([]),
    role === 'administrator'
      ? db.reference('promoter_reports').toArray()
      : role === 'promoter'
        ? db
            .reference('promoter_reports')
            .where('promoter_id')
            .equals(userId)
            .toArray()
        : Promise.resolve([]),
  ]);

  const items: ReportListItem[] = [
    ...merchantRows.map(row => ({...row, kind: 'merchant' as const})),
    ...promoterRows.map(row => ({...row, kind: 'promoter' as const})),
  ]
    .filter(report => {
      if (!search) return true;

      const searchText =
        report.search_text ?? `${report.salesman_name} ${report.zone}`;
      return searchText.toLowerCase().includes(search.toLowerCase());
    })
    .sort(
      (first, second) =>
        second.submitted_at.localeCompare(first.submitted_at) ||
        second.id - first.id ||
        second.kind.localeCompare(first.kind),
    );

  return toPage(items.slice(offset, offset + limit + 1), limit);
}
