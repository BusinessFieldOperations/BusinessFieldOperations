import type {JSX} from 'preact';

import {NEW_ADMIN_USER_KEY} from '@/lib/adminUsers';
import {useAuth} from '@/lib/AuthContext';
import {useDialogParam} from '@/lib/useDialogParam';

import {UserCreateDialog} from './UserCreateDialog';
import {UserDetailDialog} from './UserDetailDialog';
import {UserEditDialog} from './UserEditDialog';

/**
 * Mount ONCE in the dashboard. Administrators open these dialogs through the
 * URL, from any tab:
 *
 * - `?adminUser=new`: the form for a new user.
 * - `?adminUser=<id>`: that user's card, with the buttons to their tasks and
 *   reports.
 * - `?editUser=<id>`: the edit form, opened from the card. It is drawn above
 *   the card, so Back (or saving) returns to it.
 */
export function UserDialogs(): JSX.Element | null {
  const {profile} = useAuth();
  const adminUser = useDialogParam('adminUser');
  const editUser = useDialogParam('editUser');

  if (profile?.role !== 'administrator') {
    return null;
  }

  // `key` gives every user a fresh dialog (and fresh form state).
  return (
    <>
      {adminUser.value === NEW_ADMIN_USER_KEY ? (
        <UserCreateDialog key={adminUser.value} onClose={adminUser.close} />
      ) : null}
      {adminUser.value !== null && adminUser.value !== NEW_ADMIN_USER_KEY ? (
        <UserDetailDialog
          key={adminUser.value}
          userId={adminUser.value}
          onClose={adminUser.close}
        />
      ) : null}
      {editUser.value !== null ? (
        <UserEditDialog
          key={editUser.value}
          userId={editUser.value}
          onClose={editUser.close}
        />
      ) : null}
    </>
  );
}
