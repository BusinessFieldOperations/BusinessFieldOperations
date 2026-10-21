/**
 * What the user form keeps while it is open. Plain state: creating and editing
 * users needs a connection, so there are no drafts (and a password must never
 * be written to IndexedDB).
 */
import {USER_ROLES, type AdminUserItem} from '@/lib/adminUsers';
import type {UserRole} from '@/lib/profiles';
import {MIN_PASSWORD_LENGTH, type UserProfileFields} from '@/lib/userActions';

export interface UserFormValues {
  firstName: string;
  lastName: string;
  ci: string;
  /** Only asked when creating: it cannot be changed afterwards. */
  email: string;
  /** `''` until one is picked. */
  role: UserRole | '';
  /** Only shown when editing: a new user starts active. */
  isActive: boolean;
  /** Required when creating; when editing, empty keeps the current one. */
  password: string;
  passwordConfirm: string;
}

export const EMPTY_USER_FORM: UserFormValues = {
  firstName: '',
  lastName: '',
  ci: '',
  email: '',
  role: '',
  isActive: true,
  password: '',
  passwordConfirm: '',
};

/** The form of an existing user (to edit it). Passwords start empty. */
export function userFormFromUser(user: AdminUserItem): UserFormValues {
  return {
    ...EMPTY_USER_FORM,
    firstName: user.firstName,
    lastName: user.lastName,
    ci: user.ci ?? '',
    email: user.email ?? '',
    role: user.role,
    isActive: user.isActive,
  };
}

/** The role behind a select value, or `''` when nothing is selected. */
export function toUserRole(value: string): UserRole | '' {
  return (USER_ROLES as readonly string[]).includes(value)
    ? (value as UserRole)
    : '';
}

// ------------------------------------------------------------ validation

/** Why the form cannot be saved yet (the form shows a message for each). */
export type UserProblem =
  | 'missing_name'
  | 'invalid_email'
  | 'missing_role'
  | 'weak_password'
  | 'password_mismatch';

/** Same rule as the Edge Function and the contacts table. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateUserForm(
  values: UserFormValues,
  mode: 'create' | 'edit',
): UserProblem | null {
  if (values.firstName.trim() === '' || values.lastName.trim() === '') {
    return 'missing_name';
  }

  if (mode === 'create') {
    if (!EMAIL_PATTERN.test(values.email.trim())) return 'invalid_email';
    if (values.role === '') return 'missing_role';
  }

  // Editing: both password fields empty means "keep the current password".
  if (
    mode === 'create' ||
    values.password !== '' ||
    values.passwordConfirm !== ''
  ) {
    if (values.password.length < MIN_PASSWORD_LENGTH) return 'weak_password';
    if (values.password !== values.passwordConfirm) return 'password_mismatch';
  }

  return null;
}

// --------------------------------------------------------------- changes

/**
 * Only the profile fields that differ from the saved user. A blank ci is sent
 * as `null`. Editing yourself never sends `role` or `is_active`: the database
 * refuses to change them.
 */
export function buildProfileChanges(
  values: UserFormValues,
  original: AdminUserItem,
  isSelf: boolean,
): UserProfileFields {
  const changes: UserProfileFields = {};
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const ci = values.ci.trim() || null;

  if (firstName !== original.firstName) changes.first_name = firstName;
  if (lastName !== original.lastName) changes.last_name = lastName;
  if (ci !== original.ci) changes.ci = ci;

  if (!isSelf) {
    if (values.role !== '' && values.role !== original.role) {
      changes.role = values.role;
    }

    if (values.isActive !== original.isActive) {
      changes.is_active = values.isActive;
    }
  }

  return changes;
}
