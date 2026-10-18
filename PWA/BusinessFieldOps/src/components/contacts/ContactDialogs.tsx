import type {JSX} from 'preact';

import {useAuth} from '@/lib/AuthContext';
import {NEW_CONTACT_KEY, parseContactKey} from '@/lib/contacts';
import {useDialogParam} from '@/lib/useDialogParam';

import {ContactCreateDialog} from './ContactCreateDialog';
import {ContactEditDialog} from './ContactEditDialog';

/**
 * Mount ONCE in the dashboard. Any tab opens the contact dialog through the
 * URL:
 *
 * - `?contact=new`: a new contact (resumes the unfinished draft, if any).
 * - `?contact=draft-<id>`: that draft.
 * - `?contact=<ownerId>~<ms>`: an existing contact (edit or read-only).
 */
export function ContactDialogs(): JSX.Element | null {
  const {profile} = useAuth();
  const contact = useDialogParam('contact');

  if (!profile || contact.value === null) {
    return null;
  }

  // `key` gives every contact a fresh dialog (and fresh form state).
  if (contact.value === NEW_CONTACT_KEY) {
    return <ContactCreateDialog key={contact.value} onClose={contact.close} />;
  }

  const source = parseContactKey(contact.value);

  if (source?.source === 'draft') {
    return (
      <ContactCreateDialog
        key={contact.value}
        draftId={source.id}
        onClose={contact.close}
      />
    );
  }

  return (
    <ContactEditDialog
      key={contact.value}
      contactKey={contact.value}
      viewer={{id: profile.id, role: profile.role}}
      onClose={contact.close}
    />
  );
}
