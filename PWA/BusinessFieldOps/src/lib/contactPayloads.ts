import type {ContactDraft} from '@/lib/contactDrafts';

/** Why a draft cannot be sent yet (the form shows a message for each). */
export type ContactProblem =
  | 'missing_first_name'
  | 'missing_last_name'
  | 'invalid_email'
  | 'missing_extra_key'
  | 'duplicate_extra_key';

/** Same rule as `contacts_email_format_chk` in the table. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Extra field rows that have something in them, trimmed. */
function filledExtraFields(draft: ContactDraft) {
  return draft.extraFields
    .map(row => ({key: row.key.trim(), value: row.value.trim()}))
    .filter(row => row.key !== '' || row.value !== '');
}

export function validateContact(draft: ContactDraft): ContactProblem | null {
  if (draft.firstName.trim() === '') return 'missing_first_name';
  if (draft.lastName.trim() === '') return 'missing_last_name';

  const email = draft.email.trim();

  if (email !== '' && !EMAIL_PATTERN.test(email)) return 'invalid_email';

  const keys = new Set<string>();

  for (const {key} of filledExtraFields(draft)) {
    if (key === '') return 'missing_extra_key';
    if (keys.has(key)) return 'duplicate_extra_key';
    keys.add(key);
  }

  return null;
}

/** The editable fields of a contact, as the server functions expect them. */
export type ContactFields = {
  first_name: string;
  last_name: string;
  id_document: string | null;
  email: string | null;
  extra_fields: Record<string, string>;
};

/**
 * Payload of `submit_contact` (`captured_at` is added by `enqueue`, at the
 * first Send) and fields of `queueContactUpdate` (`update_contact`). Blank
 * optional fields are sent as `null`, so clearing one in an edit clears it on
 * the server.
 */
export function buildContactFields(draft: ContactDraft): ContactFields {
  return {
    first_name: draft.firstName.trim(),
    last_name: draft.lastName.trim(),
    id_document: draft.idDocument.trim() || null,
    email: draft.email.trim() || null,
    extra_fields: Object.fromEntries(
      filledExtraFields(draft).map(row => [row.key, row.value]),
    ),
  };
}
