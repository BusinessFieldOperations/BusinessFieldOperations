import './UserDetail.css';

import 'mdui/components/button.js';

import type {JSX} from 'preact';

import {
  DetailField,
  DetailGrid,
  DetailSection,
  DetailStat,
  DetailStats,
} from '@/components/detail';
import {FullScreenDialog} from '@/components/dialog';
import HeroCard from '@/components/HeroCard';
import {useAdminUserDetail, type AdminUserDetail} from '@/lib/adminUsers';
import {openDashboardTab} from '@/lib/dashboardNavigation';
import type {UserRole} from '@/lib/profiles';
import {useDialogParam} from '@/lib/useDialogParam';
import {m} from '@/paraglide/messages.js';

const ROLE_LABELS: Record<UserRole, () => string> = {
  merchant: () => m.merchant(),
  promoter: () => m.promoter(),
  administrator: () => m.administrator(),
};

/** Props of {@link UserDetailDialog}. */
export interface UserDetailDialogProps {
  userId: string;
  onClose: () => void;
}

/**
 * One user for the administrator (`?adminUser=<id>`): their card, how much
 * they have to do and report, and buttons that open the task or report list
 * already filtered by this user. Read from the local copy, so it works offline;
 * Edit (which needs a connection) opens the form above this dialog.
 */
export function UserDetailDialog({
  userId,
  onClose,
}: UserDetailDialogProps): JSX.Element {
  const user = useAdminUserDetail(userId);
  const editUser = useDialogParam('editUser');

  return (
    <FullScreenDialog
      open
      title={m.user_title()}
      closeLabel={m.close()}
      onClose={onClose}
      action={
        user
          ? {label: m.edit(), onClick: () => editUser.open(user.id)}
          : undefined
      }
    >
      {user === undefined ? (
        <p class="user-detail__message">{m.user_loading()}</p>
      ) : null}
      {user === null ? (
        <p class="user-detail__message" role="alert">
          {m.user_unavailable()}
        </p>
      ) : null}
      {user ? <UserDetails user={user} /> : null}
    </FullScreenDialog>
  );
}

function UserDetails({user}: {user: AdminUserDetail}): JSX.Element {
  // Administrators are not given tasks and do not report; show the activity
  // anyway if the account has some left from an earlier role.
  const hasActivity =
    user.role !== 'administrator' ||
    user.openTasks + user.completedTasks + user.reportCount > 0;

  return (
    <div class="user-detail">
      <HeroCard
        avatarIcon="person"
        avatarAlt={user.fullName}
        title={user.fullName}
        chips={[ROLE_LABELS[user.role]()]}
        badge={user.isActive ? '' : m.inactive()}
      />

      <DetailSection title={m.account()}>
        <DetailGrid>
          <DetailField label={m.email()}>{user.email ?? '—'}</DetailField>
          {user.ci ? (
            <DetailField label={m.user_ci()}>{user.ci}</DetailField>
          ) : null}
        </DetailGrid>
      </DetailSection>

      {hasActivity ? (
        <>
          <DetailSection title={m.user_activity()}>
            <DetailStats>
              <DetailStat label={m.user_tasks_open()} value={user.openTasks} />
              <DetailStat
                label={m.user_tasks_completed()}
                value={user.completedTasks}
              />
              <DetailStat label={m.reports()} value={user.reportCount} />
            </DetailStats>
          </DetailSection>

          <div class="user-detail__actions">
            <mdui-button
              variant="tonal"
              icon="assignment"
              onClick={() => openDashboardTab('tasks', {user: user.id})}
            >
              {m.user_view_tasks()}
            </mdui-button>
            <mdui-button
              variant="tonal"
              icon="analytics"
              onClick={() => openDashboardTab('reports', {user: user.id})}
            >
              {m.user_view_reports()}
            </mdui-button>
          </div>
        </>
      ) : null}
    </div>
  );
}
