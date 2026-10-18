import {snackbar} from 'mdui/functions/snackbar.js';

import {useState} from 'preact/hooks';

import {
  ContactNeedsConnectionError,
  deleteContactRemote,
  forgetContactLocally,
} from '@/lib/contactActions';
import type {ContactListItem, ContactViewer} from '@/lib/contacts';
import {m} from '@/paraglide/messages.js';

/** Options of {@link useContactDelete}. */
export interface UseContactDeleteOptions {
  /** `null` while it is loading. */
  contact: ContactListItem | null;
  viewer: ContactViewer;
  /** Deleted: close the dialog. */
  onDone: () => void;
}

/** Value returned by {@link useContactDelete}. */
export interface ContactDelete {
  deleting: boolean;
  /** Message to show in the form when the delete failed. */
  error: string | null;
  remove: () => Promise<void>;
}

/**
 * Deleting a contact (administrators): straight to the server, so it needs a
 * connection. The dialog closes BEFORE the local copy is removed, otherwise it
 * would flash "not available" while it is still on screen.
 */
export function useContactDelete({
  contact,
  viewer,
  onDone,
}: UseContactDeleteOptions): ContactDelete {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (deleting || !contact || contact.id === null) {
      return;
    }

    setError(null);
    setDeleting(true);

    try {
      await deleteContactRemote(contact.id);
      onDone();
      snackbar({message: m.contact_deleted(), placement: 'top'});
      void forgetContactLocally({
        contactId: contact.id,
        ownerId: contact.ownerId,
        capturedAt: contact.capturedAt,
        viewerId: viewer.id,
      }).catch(cause => console.warn('Local cleanup failed', cause));
    } catch (cause) {
      console.error('Failed to delete the contact', cause);
      setError(
        cause instanceof ContactNeedsConnectionError
          ? m.contact_error_connection_delete()
          : m.contact_error_delete(),
      );
    } finally {
      setDeleting(false);
    }
  };

  return {deleting, error, remove};
}
