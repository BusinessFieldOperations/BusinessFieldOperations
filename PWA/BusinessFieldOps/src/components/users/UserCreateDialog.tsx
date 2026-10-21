import type {JSX} from 'preact';
import {useState} from 'preact/hooks';

import {createUser, UserActionError} from '@/lib/userActions';
import {
  EMPTY_USER_FORM,
  validateUserForm,
  type UserFormValues,
} from '@/lib/userForm';
import {m} from '@/paraglide/messages.js';

import {UserFormFields} from './UserFormFields';
import {UserFrame} from './UserFrame';
import {useUserSubmit} from './useUserSubmit';

/** Props of {@link UserCreateDialog}. */
export interface UserCreateDialogProps {
  onClose: () => void;
}

/**
 * New user (`?adminUser=new`): name, ID document, email, role and a password
 * the administrator hands over. It goes straight to the server, so it needs a
 * connection.
 */
export function UserCreateDialog({
  onClose,
}: UserCreateDialogProps): JSX.Element {
  const [form, setForm] = useState<UserFormValues>(EMPTY_USER_FORM);

  const submit = useUserSubmit({
    check: () => validateUserForm(form, 'create'),
    run: async () => {
      // `check` already asked for a role; this keeps the type honest.
      if (form.role === '') {
        throw new UserActionError('invalid_role');
      }

      await createUser({
        email: form.email,
        password: form.password,
        role: form.role,
        firstName: form.firstName,
        lastName: form.lastName,
        ci: form.ci.trim() || null,
      });
    },
    doneMessage: () => m.user_created(),
    onDone: onClose,
  });

  return (
    <UserFrame
      title={m.user_new()}
      status="ready"
      actionLabel={m.save()}
      sending={submit.sending}
      error={submit.error}
      formRef={submit.formRef}
      onSend={submit.send}
      onClose={onClose}
    >
      <UserFormFields mode="create" value={form} onChange={setForm} />
    </UserFrame>
  );
}
