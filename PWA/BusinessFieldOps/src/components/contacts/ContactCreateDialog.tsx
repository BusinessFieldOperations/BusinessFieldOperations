import type {JSX} from 'preact';
import {useMemo, useRef} from 'preact/hooks';

import {useAuth} from '@/lib/AuthContext';
import {assignContact} from '@/lib/contactActions';
import {EMPTY_CONTACT_DRAFT, type ContactDraft} from '@/lib/contactDrafts';
import {buildContactFields, validateContact} from '@/lib/contactPayloads';
import {enqueue, useDraft, useReferenceTable} from '@/lib/offline';
import {useDialogParam} from '@/lib/useDialogParam';
import {m} from '@/paraglide/messages.js';

import {ContactFormFields} from './ContactFormFields';
import {ContactFrame, DiscardDraft} from './ContactFrame';
import {ContactRecipients} from './ContactRecipients';
import {
  RecipientPickerDialog,
  type RecipientOption,
} from './RecipientPickerDialog';
import {useContactSubmit} from './useContactSubmit';

/** Props of {@link ContactCreateDialog}. */
export interface ContactCreateDialogProps {
  /**
   * The draft to continue. Without it the latest unfinished draft is resumed,
   * or a blank one is started.
   */
  draftId?: string;
  onClose: () => void;
}

/**
 * New contact. It is a draft until Send: closing the app loses nothing.
 *
 * - Own contact: Send stores it on this device (the first Send freezes
 *   `captured_at`) and the outbox delivers it, with or without a connection.
 * - Administrators can also choose users to assign it to. Then the button is
 *   "Assign" and it goes straight to the server (it needs a connection).
 */
export function ContactCreateDialog({
  draftId,
  onClose,
}: ContactCreateDialogProps): JSX.Element {
  const {profile} = useAuth();
  const isAdmin = profile?.role === 'administrator';
  const draft = useDraft<ContactDraft>({
    kind: 'contact',
    ownerId: profile?.id,
    draftId,
    initialValue: EMPTY_CONTACT_DRAFT,
  });
  const {value, setValue} = draft;

  const profiles = useReferenceTable('profiles');
  const pickRecipients = useDialogParam('pickRecipients');
  const recipients = useMemo<RecipientOption[] | undefined>(
    () =>
      profiles
        ?.filter(user => user.is_active)
        .map(user => ({
          id: user.id,
          name: `${user.first_name} ${user.last_name}`.trim(),
          role: user.role,
        }))
        .sort((first, second) => first.name.localeCompare(second.name)),
    [profiles],
  );

  const recipientIds = isAdmin ? value.recipientIds : [];
  const assigning = recipientIds.length > 0;
  // Taken at the first attempt to assign and kept for retries: it is the
  // idempotency key, so a retry never creates the contact twice.
  const assignedAtRef = useRef<string | null>(null);

  const submit = useContactSubmit({
    ownerId: profile?.id,
    check: () => validateContact(value),
    run: async () => {
      if (!profile) {
        throw new Error('A contact needs its owner');
      }

      const fields = buildContactFields(value);

      if (assigning) {
        assignedAtRef.current ??= new Date().toISOString();

        const result = await assignContact({
          userId: profile.id,
          capturedAt: assignedAtRef.current,
          fields,
          ownerIds: recipientIds,
        });
        await draft.reset();

        const total = result.created + result.skipped;

        return total === 1
          ? m.contact_assigned_one()
          : m.contact_assigned_many({count: String(total)});
      }

      await enqueue({
        kind: 'contact',
        ownerId: profile.id,
        draftId: draft.draftId,
        payload: fields,
      });
      // The draft id is an outbox id now: never reuse it.
      await draft.reset();

      return m.contact_saved_device();
    },
    doneMessage: message => message,
    onDone: onClose,
  });

  const handleDiscard = async () => {
    await draft.reset();
    onClose();
  };

  return (
    <>
      <ContactFrame
        title={m.contact_new()}
        status={draft.ready ? 'ready' : 'loading'}
        actionLabel={assigning ? m.contact_assign() : m.send()}
        sending={submit.sending}
        error={submit.error}
        formRef={submit.formRef}
        onSend={submit.send}
        onClose={onClose}
      >
        <ContactFormFields value={value} onChange={setValue} />
        {isAdmin ? (
          <ContactRecipients
            recipientIds={recipientIds}
            users={recipients}
            onRemove={userId =>
              setValue(previous => ({
                ...previous,
                recipientIds: previous.recipientIds.filter(id => id !== userId),
              }))
            }
            onChoose={() => pickRecipients.open('1')}
          />
        ) : null}
        <DiscardDraft onDiscard={handleDiscard} />
      </ContactFrame>

      {isAdmin ? (
        <RecipientPickerDialog
          open={pickRecipients.isOpen}
          users={recipients}
          selected={recipientIds}
          onClose={pickRecipients.close}
          onConfirm={userIds => {
            setValue(previous => ({...previous, recipientIds: userIds}));
            pickRecipients.close();
          }}
        />
      ) : null}
    </>
  );
}
