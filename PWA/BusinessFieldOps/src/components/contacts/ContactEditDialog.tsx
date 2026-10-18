import './ContactForm.css';

import type {JSX} from 'preact';
import {useEffect, useState} from 'preact/hooks';

import {
  DetailBadge,
  DetailField,
  DetailGrid,
  DetailSection,
} from '@/components/detail';
import {updateContactDirect} from '@/lib/contactActions';
import {draftFromContact, type ContactDraft} from '@/lib/contactDrafts';
import {buildContactFields, validateContact} from '@/lib/contactPayloads';
import {
  canDeleteContact,
  getContactEditMode,
  useContactView,
  type ContactEditMode,
  type ContactListItem,
  type ContactViewer,
} from '@/lib/contacts';
import {queueContactUpdate} from '@/lib/offline';
import {m} from '@/paraglide/messages.js';

import {ContactFormFields} from './ContactFormFields';
import {ContactFrame, type ContactFrameStatus} from './ContactFrame';
import {DeleteContact} from './DeleteContact';
import {useContactDelete} from './useContactDelete';
import {useContactSubmit} from './useContactSubmit';

/** Props of {@link ContactEditDialog}. */
export interface ContactEditDialogProps {
  /** `<ownerId>~<captured_at ms>` (see `contactKey`). */
  contactKey: string;
  viewer: ContactViewer;
  onClose: () => void;
}

/** Badges and notes above the fields: where the contact stands. */
function ContactStatusInfo({
  contact,
  viewer,
  mode,
}: {
  contact: ContactListItem;
  viewer: ContactViewer;
  mode: ContactEditMode;
}): JSX.Element | null {
  const showOwner = contact.ownerName !== '' && contact.ownerId !== viewer.id;
  const hasBadges = contact.status !== 'sent' || contact.assignedByAdmin;

  if (!hasBadges && !contact.errorMessage && !showOwner && mode !== 'direct') {
    return null;
  }

  return (
    <section class="contact-form__status">
      {hasBadges ? (
        <div class="contact-form__badges">
          {contact.status === 'queued' ? (
            <DetailBadge>{m.contact_status_queued()}</DetailBadge>
          ) : null}
          {contact.status === 'failed' ? (
            <DetailBadge tone="error">{m.contact_status_failed()}</DetailBadge>
          ) : null}
          {contact.assignedByAdmin ? (
            <DetailBadge>{m.contact_assigned()}</DetailBadge>
          ) : null}
        </div>
      ) : null}
      {contact.errorMessage ? (
        <p class="contact-form__error" role="alert">
          {contact.errorMessage}
        </p>
      ) : null}
      {showOwner ? (
        <p class="contact-form__muted">
          {m.contact_owner()}: {contact.ownerName}
        </p>
      ) : null}
      {mode === 'direct' ? (
        <p class="contact-form__muted">{m.contact_online_only()}</p>
      ) : null}
    </section>
  );
}

/** What a user sees of a contact an administrator assigned to them. */
function ContactDetails({contact}: {contact: ContactListItem}): JSX.Element {
  return (
    <DetailSection title={m.contact_title()}>
      <DetailGrid>
        <DetailField label={m.contact_first_name()}>
          {contact.firstName}
        </DetailField>
        <DetailField label={m.contact_last_name()}>
          {contact.lastName}
        </DetailField>
        {contact.idDocument ? (
          <DetailField label={m.contact_id_document()}>
            {contact.idDocument}
          </DetailField>
        ) : null}
        {contact.email ? (
          <DetailField label={m.email()}>{contact.email}</DetailField>
        ) : null}
        {Object.entries(contact.extraFields).map(([name, entry]) => (
          <DetailField key={name} label={name}>
            {entry}
          </DetailField>
        ))}
      </DetailGrid>
    </DetailSection>
  );
}

/**
 * An existing contact (`?contact=<ownerId>~<ms>`): edit form for what the
 * viewer may change, plain details for what they may not.
 *
 * - Own contact: Save goes through the outbox, so it works offline.
 * - Somebody else's (administrators): Save goes straight to the server.
 * - Assigned by an administrator (users): read-only.
 *
 * Administrators can also delete the contact (needs a connection).
 */
export function ContactEditDialog({
  contactKey,
  viewer,
  onClose,
}: ContactEditDialogProps): JSX.Element {
  const contact = useContactView(contactKey, viewer.id, viewer.role);
  const mode = contact ? getContactEditMode(viewer, contact) : 'none';
  const editable = mode !== 'none';
  const [form, setForm] = useState<ContactDraft | null>(null);

  // The form starts from the contact the first time it is available. Later
  // changes to the contact (a sync, a delivery) never overwrite what the user
  // is typing.
  useEffect(() => {
    if (contact && editable && form === null) {
      setForm(draftFromContact(contact));
    }
  }, [contact, editable, form]);

  const submit = useContactSubmit({
    ownerId: viewer.id,
    check: () => (form ? validateContact(form) : 'missing_first_name'),
    run: async () => {
      if (!contact || !form) {
        throw new Error('There is no contact to save');
      }

      const fields = buildContactFields(form);

      // Nothing changed: nothing to queue or send.
      if (
        JSON.stringify(fields) ===
        JSON.stringify(buildContactFields(draftFromContact(contact)))
      ) {
        return;
      }

      if (mode === 'direct') {
        if (contact.id === null) {
          throw new Error('The contact is not on the server yet');
        }

        await updateContactDirect(contact.id, fields);
        return;
      }

      await queueContactUpdate({
        ownerId: viewer.id,
        contactCapturedAt: contact.capturedAt,
        fields,
      });
    },
    doneMessage: () =>
      mode === 'direct'
        ? m.contact_updated()
        : m.contact_changes_saved_device(),
    onDone: onClose,
  });

  const remover = useContactDelete({
    contact: contact ?? null,
    viewer,
    onDone: onClose,
  });
  const canDelete = contact ? canDeleteContact(viewer, contact) : false;

  let status: ContactFrameStatus = 'ready';

  if (contact === null) {
    status = 'unavailable';
  } else if (contact === undefined || (editable && form === null)) {
    status = 'loading';
  }

  return (
    <ContactFrame
      title={
        contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : m.contact_title()
      }
      status={status}
      actionLabel={editable ? m.save() : undefined}
      sending={submit.sending || remover.deleting}
      error={submit.error ?? remover.error}
      formRef={submit.formRef}
      onSend={submit.send}
      onClose={onClose}
    >
      {contact ? (
        <ContactStatusInfo contact={contact} viewer={viewer} mode={mode} />
      ) : null}
      {contact && editable && form ? (
        <ContactFormFields
          value={form}
          onChange={update =>
            setForm(previous => (previous ? update(previous) : previous))
          }
        />
      ) : null}
      {contact && !editable ? <ContactDetails contact={contact} /> : null}
      {contact && canDelete ? (
        <DeleteContact busy={remover.deleting} onDelete={remover.remove} />
      ) : null}
    </ContactFrame>
  );
}
