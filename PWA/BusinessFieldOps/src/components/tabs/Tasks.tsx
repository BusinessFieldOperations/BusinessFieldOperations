import 'mdui/components/button.js';

import {useCallback, useMemo, useState} from 'preact/hooks';

import {DateField, SelectField} from '@/components/form';
import {ListContainer, ListItem} from '@/components/list';
import {SearchBar} from '@/components/search';
import {AdminTaskIcon, TaskStateBadge} from '@/components/tasks';
import {
  getCachedAdminTasksPage,
  NEW_ADMIN_TASK_KEY,
  type AdminTaskItem,
  type AdminTaskStatusFilter,
} from '@/lib/adminTasks';
import {useAuth} from '@/lib/AuthContext';
import {
  db,
  REFERENCE_META_KEY,
  useLiveQuery,
  useReferenceTable,
} from '@/lib/offline';
import type {Page, PageRequest} from '@/lib/pagination';
import {useDialogParam} from '@/lib/useDialogParam';
import {useInfiniteScroll} from '@/lib/useInfiniteScroll';
import {useListSearch} from '@/lib/useListSearch';
import {usePagedList} from '@/lib/usePagedList';
import {m} from '@/paraglide/messages.js';
import {useUrlFilter} from '@/lib/useUrlFilter';

import './Tasks.css';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDateTime = (value: string) => dateFormatter.format(new Date(value));

const getTaskKey = (task: AdminTaskItem) => task.id;

/** Second and third lines of a row: who and when, then how it went. */
function getTaskDetails(task: AdminTaskItem) {
  const assignee = task.assigneeName || m.unknown_employee();
  const outcome = [
    task.completedAt
      ? m.task_completed_on({date: formatDateTime(task.completedAt)})
      : null,
    task.description,
  ]
    .filter(Boolean)
    .join(' · ');

  return [
    `${assignee} · ${formatDateTime(task.assignedAt)}`,
    outcome || undefined,
  ] as const;
}

/**
 * Administrator's task list: every task with its state (new, reported,
 * completed), searchable and filterable by user, status and assigned date.
 * It reads the local copy, so it works offline.
 */
export default function Tasks() {
  const {profile, profileLoading, profileError} = useAuth();
  const profileId = profile?.id;
  const isAdmin = profile?.role === 'administrator';
  const adminTask = useDialogParam('adminTask');
  const initialUser = useUrlFilter('user');
  const search = useListSearch(300, 2, initialUser !== '');
  const [assigneeId, setAssigneeId] = useState(initialUser);
  const [status, setStatus] = useState<AdminTaskStatusFilter>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const profiles = useReferenceTable('profiles');

  // Tasks are only ever given to merchants and promoters.
  const userOptions = useMemo(
    () =>
      (profiles ?? [])
        .filter(user => user.role !== 'administrator')
        .map(user => ({
          value: user.id,
          label: `${user.first_name} ${user.last_name}`.trim(),
        }))
        .sort((first, second) => first.label.localeCompare(second.label)),
    [profiles],
  );

  // The list starts over when the local data changes. A sync replaces every
  // table (the report counts, names and establishments are read from them);
  // completing or reopening a task edits its row in place, so the tasks are
  // read in full to follow those writes.
  const lastSyncedAt = useLiveQuery(
    async () => (await db.syncMeta.get(REFERENCE_META_KEY))?.syncedAt ?? null,
    [],
    null,
  );
  const tasksVersion = useLiveQuery(
    async () => {
      await db.reference('tasks').toArray();

      return Date.now();
    },
    [],
    0,
  );

  const fetchTasks = useCallback(
    (request: PageRequest) =>
      profileId && isAdmin
        ? getCachedAdminTasksPage({
            ...request,
            search: search.term,
            assigneeId: assigneeId || null,
            status,
            from,
            to,
          })
        : Promise.resolve<Page<AdminTaskItem>>({items: [], hasMore: false}),
    [
      search.term,
      assigneeId,
      status,
      from,
      to,
      profileId,
      isAdmin,
      lastSyncedAt,
      tasksVersion,
    ],
  );

  const {
    items: tasks,
    status: listStatus,
    hasMore,
    loadMore,
    retry,
  } = usePagedList(fetchTasks, {
    enabled: isAdmin,
    getKey: getTaskKey,
  });

  const sentinelRef = useInfiniteScroll(
    loadMore,
    hasMore && listStatus === 'idle',
  );

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

  // Only administrators have this tab.
  if (!isAdmin) {
    return null;
  }

  // Closing the search also drops every filter, like it drops the text.
  const handleSearchClick = () => {
    if (search.open) {
      setAssigneeId('');
      setStatus('');
      setFrom('');
      setTo('');
    }
    search.toggle();
  };

  const handleStatusChange = (value: string) =>
    setStatus(value === 'completed' || value === 'uncompleted' ? value : '');

  const isFiltering =
    search.term !== '' ||
    assigneeId !== '' ||
    status !== '' ||
    from !== '' ||
    to !== '';

  return (
    <div class="tasks-tab">
      <h1>{m.tasks()}</h1>

      {search.open ? (
        <div class="tasks-filters">
          <SearchBar
            value={search.query}
            onChange={search.setQuery}
            placeholder={m.tasks_search_placeholder()}
          />
          <div class="tasks-filters__fields">
            <SelectField
              label={m.task_filter_user()}
              value={assigneeId}
              options={userOptions}
              onChange={setAssigneeId}
              clearable
            />
            <SelectField
              label={m.task_filter_status()}
              value={status}
              options={[
                {value: 'completed', label: m.task_status_completed()},
                {value: 'uncompleted', label: m.task_status_uncompleted()},
              ]}
              onChange={handleStatusChange}
              clearable
            />
            <DateField
              label={m.task_filter_from()}
              value={from}
              max={to || undefined}
              onChange={setFrom}
            />
            <DateField
              label={m.task_filter_to()}
              value={to}
              min={from || undefined}
              onChange={setTo}
            />
          </div>
        </div>
      ) : null}

      <ListContainer
        showAdd
        showSearch
        addLabel={m.task_add()}
        onAddClick={() => adminTask.open(NEW_ADMIN_TASK_KEY)}
        searchLabel={m.search_tasks()}
        onSearchClick={handleSearchClick}
        className="tasks-list"
        listLabel={m.tasks()}
      >
        {listStatus === 'loading' ? (
          <li class="tasks-loading">{m.tasks_loading()}</li>
        ) : null}

        {listStatus === 'idle' && tasks.length === 0 ? (
          <li class="tasks-empty">
            {isFiltering ? m.tasks_no_match() : m.tasks_none()}
          </li>
        ) : null}

        {tasks.map(task => (
          <ListItem
            key={task.id}
            className={
              task.state === 'completed' ? 'admin-task--completed' : undefined
            }
            icon={<AdminTaskIcon state={task.state} count={task.reportCount} />}
            headline={task.establishmentName}
            details={getTaskDetails(task)}
            actions={
              task.state === 'open' ? null : (
                <TaskStateBadge state={task.state} />
              )
            }
            itemAction={() => adminTask.open(task.id)}
          />
        ))}
      </ListContainer>

      <div ref={sentinelRef} class="tasks-loader" aria-live="polite">
        {listStatus === 'loadingMore' ? m.tasks_loading_more() : null}
        {listStatus === 'error' ? (
          <>
            <span role="alert">{m.tasks_load_error()}</span>
            <mdui-button variant="text" onClick={retry}>
              {m.retry()}
            </mdui-button>
          </>
        ) : null}
        {listStatus === 'idle' && !hasMore && tasks.length > 0
          ? m.tasks_no_more()
          : null}
      </div>
    </div>
  );
}
