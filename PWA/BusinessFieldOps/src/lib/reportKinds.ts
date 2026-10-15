import type {OfflineKind} from '@/lib/offline';
import type {UserRole} from '@/lib/profiles';
import type {ReportKind} from '@/lib/reports';

/** Report kind a role creates; administrators create none (RLS forbids it). */
export function reportKindForRole(
  role: UserRole | undefined,
): ReportKind | null {
  return role === 'merchant' || role === 'promoter' ? role : null;
}

/** Kind used by drafts and the outbox for each report kind. */
export const OFFLINE_KIND: Record<ReportKind, OfflineKind> = {
  merchant: 'merchant_report',
  promoter: 'promoter_report',
};
