import 'mdui/components/button.js';

import {useCallback} from 'preact/hooks';

import {ListContainer, ListItem} from '@/components/list';
import {SearchBar} from '@/components/search';
import {useAuth} from '@/lib/AuthContext';
import type {PageRequest} from '@/lib/pagination';
import {getCachedReportsPage, type ReportListItem} from '@/lib/reports';
import {OutboxItemActions} from '@/components/reports';
import {db, listOutbox, REFERENCE_META_KEY, useLiveQuery} from '@/lib/offline';
import {useInfiniteScroll} from '@/lib/useInfiniteScroll';
import {useListSearch} from '@/lib/useListSearch';
import {usePagedList} from '@/lib/usePagedList';
import {useDialogParam} from '@/lib/useDialogParam';
import {m} from '@/paraglide/messages.js';

import './Report.css';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatReportDate = (value: string) =>
  dateFormatter.format(new Date(value));

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

  // const handleOpenReport = useCallback((report: ReportListItem) => {
  //   // TODO: open the report detail.
  //   console.log('Report item placeholder clicked:', report);
  // }, []);
  const view = useDialogParam('view');

  if (profileLoading) {
    return (
      <main class="centered-container" aria-live="polite">
        <p>{m.profile_loading()}</p>
      </main>
    );
  }

  if (profileError || !profile) {
    return (
      <main class="centered-container">
        <p role="alert">
          {profileError ? m.profile_load_error() : m.profile_unavailable()}
        </p>
      </main>
    );
  }

  return (
    <div class="report-tab">
      <h1>{m.reports()}</h1>

      {search.open ? (
        <SearchBar
          value={search.query}
          onChange={search.setQuery}
          placeholder={m.search_by_name_or_zone()}
        />
      ) : null}

      <ListContainer
        showAdd={!isAdmin}
        showSearch
        addLabel={m.report_add()}
        onAddClick={() => pickTask.open('1')}
        searchLabel={m.report_search()}
        onSearchClick={search.toggle}
        className="report-list"
        listLabel={m.reports_list()}
      >
        {status === 'loading' ? (
          <li class="report-loading">{m.reports_loading()}</li>
        ) : null}

        {status === 'idle' && reports.length === 0 ? (
          <li class="report-empty">
            {search.term
              ? m.reports_no_match({term: search.term})
              : m.reports_none()}
          </li>
        ) : null}

        {reports.map(report => (
          <ListItem
            key={getReportKey(report)}
            headline={report.salesman_name}
            details={[
              report.zone,
              report.errorMessage ??
                (report.status === 'queued' ? `${m.status_queued()} · ` : '') +
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
            itemAction={() => view.open(getReportKey(report))}
          />
        ))}
      </ListContainer>

      <div ref={sentinelRef} class="report-loader" aria-live="polite">
        {status === 'loadingMore' ? m.reports_loading_more() : null}
        {status === 'error' ? (
          <>
            <span role="alert">{m.reports_load_error()}</span>
            <mdui-button variant="text" onClick={retry}>
              {m.retry()}
            </mdui-button>
          </>
        ) : null}
        {status === 'idle' && !hasMore && reports.length > 0
          ? m.reports_no_more()
          : null}
      </div>
    </div>
  );
}
