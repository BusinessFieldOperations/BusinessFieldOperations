import type {JSX} from 'preact';

import {SelectField, SwitchField, TextField} from '@/components/form';
import {USER_ROLES} from '@/lib/adminUsers';
import type {UserRole} from '@/lib/profiles';
import {MIN_PASSWORD_LENGTH} from '@/lib/userActions';
import {toUserRole, type UserFormValues} from '@/lib/userForm';
import {m} from '@/paraglide/messages.js';

import './UserForm.css';

const ROLE_LABELS: Record<UserRole, () => string> = {
  merchant: () => m.merchant(),
  promoter: () => m.promoter(),
  administrator: () => m.administrator(),
};

/** Props of {@link UserFormFields}. */
export interface UserFormFieldsProps {
  /** Creating asks for the email and a password; editing for the status. */
  mode: 'create' | 'edit';
  value: UserFormValues;
  /** Takes a function so quick consecutive edits never use a stale value. */
  onChange: (_update: (_previous: UserFormValues) => UserFormValues) => void;
  /** Editing yourself: role and status cannot change. */
  lockedSelf?: boolean;
  /** Role or status are about to change: warn about pending work. */
  warn?: boolean;
}

/** The fields of a user: who they are, their role and their password. */
export function UserFormFields({
  mode,
  value,
  onChange,
  lockedSelf = false,
  warn = false,
}: UserFormFieldsProps): JSX.Element {
  const isCreate = mode === 'create';

  return (
    <>
      <section class="user-form__section">
        <div class="user-form__names">
          <TextField
            label={m.user_first_name()}
            value={value.firstName}
            required
            autocomplete="off"
            onChange={firstName =>
              onChange(previous => ({...previous, firstName}))
            }
          />
          <TextField
            label={m.user_last_name()}
            value={value.lastName}
            required
            autocomplete="off"
            onChange={lastName =>
              onChange(previous => ({...previous, lastName}))
            }
          />
        </div>
        <TextField
          label={m.user_ci()}
          value={value.ci}
          autocomplete="off"
          onChange={ci => onChange(previous => ({...previous, ci}))}
        />
        {isCreate ? (
          <TextField
            label={m.email()}
            type="email"
            value={value.email}
            required
            autocomplete="off"
            onChange={email => onChange(previous => ({...previous, email}))}
          />
        ) : null}
      </section>

      <section class="user-form__section">
        <SelectField
          label={m.role()}
          value={value.role}
          options={USER_ROLES.map(role => ({
            value: role,
            label: ROLE_LABELS[role](),
          }))}
          required
          disabled={lockedSelf}
          onChange={role =>
            onChange(previous => ({...previous, role: toUserRole(role)}))
          }
        />
        {isCreate ? null : (
          <SwitchField
            label={m.active()}
            checked={value.isActive}
            disabled={lockedSelf}
            onChange={isActive =>
              onChange(previous => ({...previous, isActive}))
            }
          />
        )}
        {lockedSelf ? (
          <p class="user-form__muted">{m.user_self_locked()}</p>
        ) : null}
        {warn ? (
          <p class="user-form__muted">{m.user_change_warning()}</p>
        ) : null}
      </section>

      <section class="user-form__section">
        <h3 class="user-form__heading">{m.password()}</h3>
        <TextField
          label={isCreate ? m.password() : m.user_password_new()}
          type="password"
          value={value.password}
          required={isCreate}
          minLength={MIN_PASSWORD_LENGTH}
          autocomplete="new-password"
          helper={isCreate ? undefined : m.user_password_hint_edit()}
          onChange={password => onChange(previous => ({...previous, password}))}
        />
        <TextField
          label={m.user_password_confirm()}
          type="password"
          value={value.passwordConfirm}
          required={isCreate || value.password !== ''}
          autocomplete="new-password"
          onChange={passwordConfirm =>
            onChange(previous => ({...previous, passwordConfirm}))
          }
        />
      </section>
    </>
  );
}
