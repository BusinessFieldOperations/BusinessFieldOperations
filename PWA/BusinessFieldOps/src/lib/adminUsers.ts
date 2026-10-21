import {db, type ReferenceRow} from '@/lib/offline/db';
import {useLiveQuery} from '@/lib/offline/useLiveQuery';
import {toPage, type Page, type PageRequest} from '@/lib/pagination';
import type {UserRole} from '@/lib/profiles';
import {normalizeSearchText} from '@/lib/useLocalSearch';

/**
 * `?adminUser=new`: the form for a new user. Any other value is the id of the
 * user to show.
 */
export const NEW_ADMIN_USER_KEY = 'new';

/** Roles an account can have, in the order they are offered. */
export const USER_ROLES: readonly UserRole[] = [
  'merchant',
  'promoter',
  'administrator',
];

// ----------------------------------------------------------------- model

/** A user ready to display in the administrator's list. */
export interface AdminUserItem {
  id: string;
  firstName: string;
  lastName: string;
  /** First and last name, trimmed. */
  fullName: string;
  /** Copy of the login email; `null` for accounts made before it was kept. */
  email: string | null;
  ci: string | null;
  role: UserRole;
  isActive: boolean;
}

const fromRow = (row: ReferenceRow<'profiles'>): AdminUserItem => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: `${row.first_name} ${row.last_name}`.trim(),
  email: row.email,
  ci: row.ci,
  role: row.role,
  isActive: row.is_active,
});

const byName = (first: AdminUserItem, second: AdminUserItem) =>
  `${first.lastName} ${first.firstName}`.localeCompare(
    `${second.lastName} ${second.firstName}`,
  ) || first.id.localeCompare(second.id);

// ------------------------------------------------------------------ list

/** `''` shows every user. */
export type AdminUserStatusFilter = '' | 'active' | 'inactive';

/** Filters of the administrator's user list. Empty values filter nothing. */
export interface AdminUserFilters {
  /**
   * Text to look for in name, email and ci. Every word must match, accents
   * and case are ignored.
   */
  search?: string;
  role?: UserRole | '';
  status?: AdminUserStatusFilter;
}

export interface AdminUsersPageRequest extends PageRequest, AdminUserFilters {}

function matchesFilters(
  user: AdminUserItem,
  {search = '', role = '', status = ''}: AdminUserFilters,
): boolean {
  if (role && user.role !== role) {
    return false;
  }

  if (status === 'active' && !user.isActive) {
    return false;
  }

  if (status === 'inactive' && user.isActive) {
    return false;
  }

  const words = normalizeSearchText(search.trim()).split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return true;
  }

  const haystack = normalizeSearchText(
    [user.fullName, user.email, user.ci].filter(Boolean).join(' '),
  );

  return words.every(word => haystack.includes(word));
}

/**
 * One page of users by name, from the local copy (works offline).
 * Only administrators call this: RLS gives them every profile, so the local
 * copy has them all.
 */
export async function getCachedUsersPage({
  offset,
  limit,
  search,
  role,
  status,
}: AdminUsersPageRequest): Promise<Page<AdminUserItem>> {
  const users = (await db.reference('profiles').toArray())
    .map(fromRow)
    .sort(byName);
  const matching = users.filter(user =>
    matchesFilters(user, {search, role, status}),
  );

  return toPage(matching.slice(offset, offset + limit + 1), limit);
}

// ---------------------------------------------------------------- detail

/** One user with what the administrator can jump to from the card. */
export interface AdminUserDetail extends AdminUserItem {
  openTasks: number;
  completedTasks: number;
  /** Merchant and promoter reports of the user, sent ones. */
  reportCount: number;
}

/**
 * One user and their counters, from the local data. `null` if the profile is
 * not there. The counts come from indexed reads of the local copy, which
 * holds every task and report for an administrator.
 */
export async function loadAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  const profile = await db.reference('profiles').get(userId);

  if (!profile) {
    return null;
  }

  const [tasks, merchantReports, promoterReports] = await Promise.all([
    db.reference('tasks').where('assigned_to').equals(userId).toArray(),
    db
      .reference('merchant_reports')
      .where('merchant_id')
      .equals(userId)
      .count(),
    db
      .reference('promoter_reports')
      .where('promoter_id')
      .equals(userId)
      .count(),
  ]);
  const completedTasks = tasks.filter(task => task.completed_at !== null);

  return {
    ...fromRow(profile),
    openTasks: tasks.length - completedTasks.length,
    completedTasks: completedTasks.length,
    reportCount: merchantReports + promoterReports,
  };
}

/**
 * The user behind `?adminUser=<id>`. `undefined` while loading, `null` if it
 * is not there. Follows the local data: an edit, a sync or a new report
 * updates the dialog by itself.
 */
export function useAdminUserDetail(
  userId: string,
): AdminUserDetail | null | undefined {
  return useLiveQuery(() => loadAdminUserDetail(userId), [userId]);
}
