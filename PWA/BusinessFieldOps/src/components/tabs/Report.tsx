import 'mdui/components/button.js';

import {useCallback} from 'preact/hooks';

import {ListContainer, ListItem} from '@/components/list';
import {SearchBar} from '@/components/search';
import {useAuth} from '@/lib/AuthContext';
import type {PageRequest} from '@/lib/pagination';
import {
  getCachedReportsPage,
  // type ReportKind,
  type ReportListItem,
} from '@/lib/reports';
import {OutboxItemActions} from '@/components/reports';
import {db, listOutbox, REFERENCE_META_KEY, useLiveQuery} from '@/lib/offline';
import {useInfiniteScroll} from '@/lib/useInfiniteScroll';
import {useListSearch} from '@/lib/useListSearch';
import {usePagedList} from '@/lib/usePagedList';
import {useDialogParam} from '@/lib/useDialogParam';

import './Report.css';

// const KIND_LABELS: Record<ReportKind, string> = {
//   merchant: 'Merchant',
//   promoter: 'Promoter',
// };

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatReportDate = (value: string) =>
  dateFormatter.format(new Date(value));

/** `ids` repeat across both tables, so the kind is part of the key. */
// const getReportKey = (report: ReportListItem) => `${report.kind}-${report.id}`;

export default function Report() {
  const pickTask = useDialogParam('pickTask');
  const {profile, profileLoading, profileError} = useAuth();
  const isAdmin = profile?.role === 'administrator';
  const profileId = profile?.id;
  const profileRole = profile?.role;
  const search = useListSearch();
  const lastSyncedAt = useLiveQuery(
    async () => (await db.syncMeta.get(REFERENCE_META_KEY))?.syncedAt ?? null,
    [],
    null,
  );
  const outboxSignature = useLiveQuery(
    async () =>
      profileId
        ? (await listOutbox(profileId))
            .map(item => `${item.id}:${item.status}`)
            .join('|')
        : '',
    [profileId],
    '',
  );

  const fetchReports = useCallback(
    (request: PageRequest) =>
      profileId && profileRole
        ? getCachedReportsPage({
            ...request,
            userId: profileId,
            role: profileRole,
            search: search.term,
          })
        : Promise.resolve({items: [], hasMore: false}),
    // Refresh when the cached tables finish syncing or another user signs in.
    [search.term, profileId, profileRole, lastSyncedAt, outboxSignature],
  );

  const getReportKey = (report: ReportListItem) =>
    report.outboxId
      ? `outbox-${report.outboxId}`
      : `${report.kind}-${report.id}`;

  const {
    items: reports,
    status,
    hasMore,
    loadMore,
    retry,
  } = usePagedList(fetchReports, {
    enabled: Boolean(profile),
    getKey: getReportKey,
  });

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && status === 'idle');

  const handleOpenReport = useCallback((report: ReportListItem) => {
    // TODO: open the report detail.
    console.log('Report item placeholder clicked:', report);
  }, []);

  if (profileLoading) {
    return (
      <main class="centered-container" aria-live="polite">
        <p>Loading profile...</p>
      </main>
    );
  }

  if (profileError || !profile) {
    return (
      <main class="centered-container">
        <p role="alert">
          {profileError
            ? 'Could not load your profile.'
            : 'No profile is available.'}
        </p>
      </main>
    );
  }

  return (
    <div class="report-tab">
      <h1>Reports</h1>

      {search.open ? (
        <SearchBar
          value={search.query}
          onChange={search.setQuery}
          placeholder="Search by name or zone"
        />
      ) : null}

      <ListContainer
        showAdd={!isAdmin}
        showSearch
        addLabel="Add report"
        onAddClick={() => pickTask.open('1')}
        searchLabel="Search reports"
        onSearchClick={search.toggle}
        className="report-list"
        listLabel="Reports list"
      >
        {status === 'loading' ? (
          <li class="report-loading">Loading reports...</li>
        ) : null}

        {status === 'idle' && reports.length === 0 ? (
          <li class="report-empty">
            {search.term
              ? `No reports match "${search.term}".`
              : 'No reports available.'}
          </li>
        ) : null}

        {reports.map(report => (
          <ListItem
            key={getReportKey(report)}
            headline={report.salesman_name}
            details={[
              report.zone,
              report.errorMessage ??
                (report.status === 'queued' ? 'Waiting to be sent · ' : '') +
                  formatReportDate(report.submitted_at),
            ]}
            actions={
              report.outboxId !== null && report.status !== 'sent' ? (
                <OutboxItemActions
                  outboxId={report.outboxId}
                  status={report.status}
                />
              ) : null
            }
            itemAction={() => handleOpenReport(report)}
          />
        ))}
      </ListContainer>

      <div ref={sentinelRef} class="report-loader" aria-live="polite">
        {status === 'loadingMore' ? 'Loading more reports...' : null}
        {status === 'error' ? (
          <>
            <span role="alert">Could not load reports.</span>
            <mdui-button variant="text" onClick={retry}>
              Retry
            </mdui-button>
          </>
        ) : null}
        {status === 'idle' && !hasMore && reports.length > 0
          ? 'No more reports'
          : null}
      </div>
    </div>
  );
}
