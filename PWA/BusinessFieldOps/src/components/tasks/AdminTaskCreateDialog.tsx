import './AdminTaskDialog.css';

import 'mdui/components/button.js';
import {snackbar} from 'mdui/functions/snackbar.js';

import type {JSX} from 'preact';
import {useEffect, useMemo, useRef, useState} from 'preact/hooks';

import {
  RecipientPickerDialog,
  type RecipientOption,
} from '@/components/contacts/RecipientPickerDialog';
import {FullScreenDialog} from '@/components/dialog';
import {DeletableChip, TextField} from '@/components/form';
import {joinClasses} from '@/components/list/classNames';
import {useEstablishments} from '@/lib/establishments';
import {useReferenceTable} from '@/lib/offline';
import {
  assignTaskIds,
  createTasks,
  TaskNeedsConnectionError,
} from '@/lib/taskActions';
import {useDialogParam} from '@/lib/useDialogParam';
import {m} from '@/paraglide/messages.js';

import {EstablishmentPickerDialog} from './EstablishmentPickerDialog';

/** Roles a task can be assigned to (the database enforces it too). */
const ASSIGNABLE_ROLES = ['merchant', 'promoter'] as const;

/** Props of {@link AdminTaskCreateDialog}. */
export interface AdminTaskCreateDialogProps {
  onClose: () => void;
}

function describeFailure(cause: unknown): string {
  return cause instanceof TaskNeedsConnectionError
    ? m.task_error_connection()
    : m.task_error_save();
}

/**
 * New task (`?adminTask=new`): an establishment, one or several users and an
 * optional description. Each user gets their own independent task. It goes
 * straight to the server, so it needs a connection.
 */
export function AdminTaskCreateDialog({
  onClose,
}: AdminTaskCreateDialogProps): JSX.Element {
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // Task id of each assignee, kept for retries: it is the idempotency key, so
  // a retry after a lost answer never creates the same task twice.
  const knownIds = useRef(new Map<string, string>());

  const pickEstablishment = useDialogParam('pickEstablishment');
  const pickRecipients = useDialogParam('pickRecipients');

  const establishments = useEstablishments();
  const profiles = useReferenceTable('profiles');
  const recipients = useMemo<RecipientOption[] | undefined>(
    () =>
      profiles
        ?.filter(
          user =>
            user.is_active &&
            (ASSIGNABLE_ROLES as readonly string[]).includes(user.role),
        )
        .map(user => ({
          id: user.id,
          name: `${user.first_name} ${user.last_name}`.trim(),
          role: user.role,
        }))
        .sort((first, second) => first.name.localeCompare(second.name)),
    [profiles],
  );

  const establishment = establishments?.find(
    item => item.id === establishmentId,
  );
  const place = establishment
    ? [establishment.location, establishment.stateName]
        .filter(Boolean)
        .join(' · ')
    : '';

  // While saving, edits would be lost: freeze the form (`inert` also blocks
  // the keyboard).
  useEffect(() => {
    formRef.current?.toggleAttribute('inert', sending);
  }, [sending]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({block: 'nearest'});
    }
  }, [error]);

  const nameOf = (userId: string) =>
    recipients?.find(user => user.id === userId)?.name ??
    m.contact_unknown_user();

  const send = async () => {
    if (sending) {
      return;
    }

    setError(null);

    if (formRef.current && !formRef.current.reportValidity()) {
      return;
    }

    if (establishmentId === null) {
      setError(m.task_problem_establishment());
      return;
    }

    if (assigneeIds.length === 0) {
      setError(m.task_problem_users());
      return;
    }

    setSending(true);

    try {
      const result = await createTasks({
        establishmentId,
        description,
        assignments: assignTaskIds(assigneeIds, knownIds.current),
      });
      const total = result.created + result.skipped;

      onClose();
      snackbar({
        message:
          total === 1
            ? m.task_created_one()
            : m.task_created_many({count: total}),
        placement: 'top',
      });
    } catch (cause) {
      console.error('Failed to create the task', cause);
      setError(describeFailure(cause));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <FullScreenDialog
        open
        title={m.task_new()}
        closeLabel={m.close()}
        onClose={onClose}
        action={{label: m.save(), onClick: send, loading: sending}}
      >
        <form
          ref={formRef}
          class={joinClasses(
            'admin-task-form',
            sending && 'admin-task-form--busy',
          )}
          onSubmit={e => e.preventDefault()}
        >
          {error ? (
            <p ref={errorRef} class="admin-task-form__error" role="alert">
              {error}
            </p>
          ) : null}

          <p class="admin-task-form__muted">{m.task_online_only()}</p>

          <section class="admin-task-form__section">
            <h3 class="admin-task-form__heading">{m.establishment()}</h3>
            {establishment ? (
              <div class="admin-task-form__selected">
                <p class="admin-task-form__selected-name">
                  {establishment.name}
                </p>
                {place ? <p class="admin-task-form__muted">{place}</p> : null}
              </div>
            ) : null}
            <mdui-button
              variant="tonal"
              icon="storefront"
              onClick={() => pickEstablishment.open('1')}
            >
              {m.task_choose_establishment()}
            </mdui-button>
          </section>

          <section class="admin-task-form__section">
            <h3 class="admin-task-form__heading">{m.task_assign_to()}</h3>
            {assigneeIds.length > 0 ? (
              <div class="admin-task-form__chips">
                {assigneeIds.map(userId => (
                  <DeletableChip
                    key={userId}
                    label={nameOf(userId)}
                    onDelete={() =>
                      setAssigneeIds(previous =>
                        previous.filter(id => id !== userId),
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
            <mdui-button
              variant="tonal"
              icon="group_add"
              onClick={() => pickRecipients.open('1')}
            >
              {m.task_choose_users()}
            </mdui-button>
          </section>

          <TextField
            label={m.task_description()}
            value={description}
            rows={3}
            onChange={setDescription}
          />
        </form>
      </FullScreenDialog>

      <EstablishmentPickerDialog
        open={pickEstablishment.isOpen}
        establishments={establishments}
        onClose={pickEstablishment.close}
        onPick={picked => {
          setEstablishmentId(picked.id);
          pickEstablishment.close();
        }}
      />

      <RecipientPickerDialog
        open={pickRecipients.isOpen}
        users={recipients}
        roles={ASSIGNABLE_ROLES}
        selected={assigneeIds}
        onClose={pickRecipients.close}
        onConfirm={userIds => {
          setAssigneeIds(userIds);
          pickRecipients.close();
        }}
      />
    </>
  );
}
