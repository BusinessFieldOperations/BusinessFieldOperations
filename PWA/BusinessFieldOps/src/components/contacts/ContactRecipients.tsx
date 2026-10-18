import './ContactForm.css';

import 'mdui/components/button.js';

import type {JSX} from 'preact';

import {DeletableChip} from '@/components/form';
import {m} from '@/paraglide/messages.js';

import type {RecipientOption} from './RecipientPickerDialog';

/** Props of {@link ContactRecipients}. */
export interface ContactRecipientsProps {
  recipientIds: readonly string[];
  /** `undefined` while loading. */
  users: readonly RecipientOption[] | undefined;
  onRemove: (_userId: string) => void;
  onChoose: () => void;
}

/**
 * "Assign to" of the new-contact form (administrators): who else gets the
 * contact. Nobody chosen means it is the administrator's own contact.
 */
export function ContactRecipients({
  recipientIds,
  users,
  onRemove,
  onChoose,
}: ContactRecipientsProps): JSX.Element {
  const nameOf = (userId: string) =>
    users?.find(user => user.id === userId)?.name ?? m.contact_unknown_user();

  return (
    <section class="contact-form__section">
      <h3 class="contact-form__heading">{m.contact_assign_to()}</h3>

      {recipientIds.length > 0 ? (
        <div class="contact-form__chips">
          {recipientIds.map(userId => (
            <DeletableChip
              key={userId}
              label={nameOf(userId)}
              onDelete={() => onRemove(userId)}
            />
          ))}
        </div>
      ) : null}

      <p class="contact-form__muted">
        {recipientIds.length > 0
          ? m.contact_assign_online()
          : m.contact_assign_hint()}
      </p>

      <mdui-button variant="tonal" icon="group_add" onClick={onChoose}>
        {m.contact_assign_choose()}
      </mdui-button>
    </section>
  );
}
