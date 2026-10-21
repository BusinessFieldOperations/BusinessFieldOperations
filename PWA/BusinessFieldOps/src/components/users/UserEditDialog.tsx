import type {JSX} from 'preact';
import {useEffect, useState} from 'preact/hooks';

import {useAdminUserDetail} from '@/lib/adminUsers';
import {useAuth} from '@/lib/AuthContext';
import {setUserPassword, updateUserProfile} from '@/lib/userActions';
import {
  buildProfileChanges,
  userFormFromUser,
  validateUserForm,
  type UserFormValues,
} from '@/lib/userForm';
import {m} from '@/paraglide/messages.js';

import {UserFormFields} from './UserFormFields';
import {UserFrame, type UserFrameStatus} from './UserFrame';
import {useUserSubmit} from './useUserSubmit';

/** Props of {@link UserEditDialog}. */
export interface UserEditDialogProps {
  userId: string;
  onClose: () => void;
}

/**
 * Edit a user (`?editUser=<id>`): names, ID document, role, status and,
 * optionally, a new password. It goes straight to the server, so it needs a
 * connection.
 *
 * Editing yourself leaves role and status locked (the database refuses them
 * too).
 */
export function UserEditDialog({
  userId,
  onClose,
}: UserEditDialogProps): JSX.Element {
  const {profile, refreshProfile} = useAuth();
  const user = useAdminUserDetail(userId);
  const isSelf = profile?.id === userId;
  const [form, setForm] = useState<UserFormValues | null>(null);

  // The form starts from the user the first time it is available. Later
  // changes to the user (a sync, a partial save) never overwrite what the
  // administrator is typing.
  useEffect(() => {
    if (user && form === null) {
      setForm(userFormFromUser(user));
    }
  }, [user, form]);

  const submit = useUserSubmit({
    check: () => (form ? validateUserForm(form, 'edit') : 'missing_name'),
    run: async () => {
      if (!user || !form) {
        throw new Error('There is no user to save');
      }

      // Against the user as it is NOW: if an earlier attempt saved the profile
      // and only the password failed, a retry sends just the password.
      const changes = buildProfileChanges(form, user, isSelf);

      if (Object.keys(changes).length > 0) {
        await updateUserProfile(user.id, changes);

        // Home shows the name from the signed-in profile.
        if (isSelf) {
          await refreshProfile();
        }
      }

      if (form.password !== '') {
        await setUserPassword(user.id, form.password);
      }
    },
    doneMessage: () => m.user_updated(),
    onDone: onClose,
  });

  let status: UserFrameStatus = 'ready';

  if (user === null) {
    status = 'unavailable';
  } else if (user === undefined || form === null) {
    status = 'loading';
  }

  const changesAccess =
    !isSelf &&
    user !== null &&
    user !== undefined &&
    form !== null &&
    (form.role !== user.role || form.isActive !== user.isActive);

  return (
    <UserFrame
      title={m.user_edit()}
      status={status}
      actionLabel={m.save()}
      sending={submit.sending}
      error={submit.error}
      formRef={submit.formRef}
      onSend={submit.send}
      onClose={onClose}
    >
      {form ? (
        <UserFormFields
          mode="edit"
          value={form}
          onChange={update =>
            setForm(previous => (previous ? update(previous) : previous))
          }
          lockedSelf={isSelf}
          warn={changesAccess}
        />
      ) : null}
    </UserFrame>
  );
}
