import 'mdui/components/button.js';
import 'mdui/components/icon.js';

import {useCallback, useState} from 'preact/hooks';

import {DetailBadge} from '@/components/detail';
import {SelectField} from '@/components/form';
import {ListContainer, ListItem} from '@/components/list';
import {SearchBar} from '@/components/search';
import {
  getCachedUsersPage,
  NEW_ADMIN_USER_KEY,
  USER_ROLES,
  type AdminUserItem,
  type AdminUserStatusFilter,
} from '@/lib/adminUsers';
import {useAuth} from '@/lib/AuthContext';
import {db, useLiveQuery} from '@/lib/offline';
import type {Page, PageRequest} from '@/lib/pagination';
import type {UserRole} from '@/lib/profiles';
import {useDialogParam} from '@/lib/useDialogParam';
import {useInfiniteScroll} from '@/lib/useInfiniteScroll';
import {useListSearch} from '@/lib/useListSearch';
import {usePagedList} from '@/lib/usePagedList';
import {m} from '@/paraglide/messages.js';

import './Users.css';

const ROLE_LABELS: Record<UserRole, () => string> = {
  merchant: () => m.merchant(),
  promoter: () => m.promoter(),
  administrator: () => m.administrator(),
};

const ROLE_ICONS: Record<UserRole, string> = {
  merchant: 'storefront',
  promoter: 'campaign',
  administrator: 'admin_panel_settings',
};

const getUserKey = (user: AdminUserItem) => user.id;

const isUserRole = (value: string): value is UserRole =>
  (USER_ROLES as readonly string[]).includes(value);

/** Second and third lines of a row: how to reach them, and their role. */
function getUserDetails(user: AdminUserItem) {
  const reach = [user.email, user.ci].filter(Boolean).join(' · ');

  return [reach || undefined, ROLE_LABELS[user.role]()] as const;
}

/**
 * Administrator's user list: every account with its role and whether it is
 * active, searchable and filterable by role and status. It reads the local
 * copy, so it works offline; creating and editing users needs a connection.
 */
export default function Users() {
  const {profile, profileLoading, profileError} = useAuth();
  const profileId = profile?.id;
  const isAdmin = profile?.role === 'administrator';
  const adminUser = useDialogParam('adminUser');
  const search = useListSearch();
  const [role, setRole] = useState<UserRole | ''>('');
  const [status, setStatus] = useState<AdminUserStatusFilter>('');

  // The list starts over when the local profiles change (an edit, a new user,
  // a sync). Reading the table is what makes the query follow its writes.
  const usersVersion = useLiveQuery(
    async () => {
      await db.reference('profiles').toArray();

      return Date.now();
    },
    [],
    0,
  );

  const fetchUsers = useCallback(
    (request: PageRequest) =>
      profileId && isAdmin
        ? getCachedUsersPage({
            ...request,
            search: search.term,
            role,
            status,
          })
        : Promise.resolve<Page<AdminUserItem>>({items: [], hasMore: false}),
    [search.term, role, status, profileId, isAdmin, usersVersion],
  );

  const {
    items: users,
    status: listStatus,
    hasMore,
    loadMore,
    retry,
  } = usePagedList(fetchUsers, {
    enabled: isAdmin,
    getKey: getUserKey,
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
      setRole('');
      setStatus('');
    }
    search.toggle();
  };

  const handleRoleChange = (value: string) =>
    setRole(isUserRole(value) ? value : '');

  const handleStatusChange = (value: string) =>
    setStatus(value === 'active' || value === 'inactive' ? value : '');

  const isFiltering = search.term !== '' || role !== '' || status !== '';

  return (
    <div class="users-tab">
      <h1>{m.users()}</h1>

      {search.open ? (
        <div class="users-filters">
          <SearchBar
            value={search.query}
            onChange={search.setQuery}
            placeholder={m.users_search_placeholder()}
          />
          <div class="users-filters__fields">
            <SelectField
              label={m.role()}
              value={role}
              options={USER_ROLES.map(value => ({
                value,
                label: ROLE_LABELS[value](),
              }))}
              onChange={handleRoleChange}
              clearable
            />
            <SelectField
              label={m.users_filter_status()}
              value={status}
              options={[
                {value: 'active', label: m.active()},
                {value: 'inactive', label: m.inactive()},
              ]}
              onChange={handleStatusChange}
              clearable
            />
          </div>
        </div>
      ) : null}

      <ListContainer
        showAdd
        showSearch
        addLabel={m.user_add()}
        onAddClick={() => adminUser.open(NEW_ADMIN_USER_KEY)}
        searchLabel={m.search_users()}
        onSearchClick={handleSearchClick}
        className="users-list"
        listLabel={m.users()}
      >
        {listStatus === 'loading' ? (
          <li class="users-loading">{m.users_loading()}</li>
        ) : null}

        {listStatus === 'idle' && users.length === 0 ? (
          <li class="users-empty">
            {isFiltering ? m.users_no_match() : m.users_none()}
          </li>
        ) : null}

        {users.map(user => (
          <ListItem
            key={user.id}
            className={user.isActive ? undefined : 'user--inactive'}
            icon={<mdui-icon name={ROLE_ICONS[user.role]} />}
            headline={user.fullName}
            details={getUserDetails(user)}
            actions={
              user.isActive ? null : (
                <span class="user-badge">
                  <DetailBadge tone="error">{m.inactive()}</DetailBadge>
                </span>
              )
            }
            itemAction={() => adminUser.open(user.id)}
          />
        ))}
      </ListContainer>

      <div ref={sentinelRef} class="users-loader" aria-live="polite">
        {listStatus === 'loadingMore' ? m.users_loading_more() : null}
        {listStatus === 'error' ? (
          <>
            <span role="alert">{m.users_load_error()}</span>
            <mdui-button variant="text" onClick={retry}>
              {m.retry()}
            </mdui-button>
          </>
        ) : null}
        {listStatus === 'idle' && !hasMore && users.length > 0
          ? m.users_no_more()
          : null}
      </div>
    </div>
  );
}
