/**
 * What a contact form keeps while it is a draft. Plain JSON (it goes to
 * IndexedDB) and independent from the server payload: `contactPayloads.ts`
 * turns it into what `submit_contact` / `update_contact` expect.
 */
import type {ContactListItem} from '@/lib/contacts';

/** One name/value row of the extra fields (a list, so rows can be empty). */
export interface ExtraFieldRow {
  key: string;
  value: string;
}

export interface ContactDraft {
  firstName: string;
  lastName: string;
  idDocument: string;
  email: string;
  extraFields: ExtraFieldRow[];
  /**
   * Administrators only: profile ids to assign the contact to. Empty means
   * the contact is just the administrator's own.
   */
  recipientIds: string[];
}

export const EMPTY_CONTACT_DRAFT: ContactDraft = {
  firstName: '',
  lastName: '',
  idDocument: '',
  email: '',
  extraFields: [],
  recipientIds: [],
};

/** The form of an existing contact (to edit it). */
export function draftFromContact(
  contact: Pick<
    ContactListItem,
    'firstName' | 'lastName' | 'idDocument' | 'email' | 'extraFields'
  >,
): ContactDraft {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    idDocument: contact.idDocument ?? '',
    email: contact.email ?? '',
    extraFields: Object.entries(contact.extraFields).map(([key, value]) => ({
      key,
      value,
    })),
    recipientIds: [],
  };
}

export function addExtraField(draft: ContactDraft): ContactDraft {
  return {
    ...draft,
    extraFields: [...draft.extraFields, {key: '', value: ''}],
  };
}

export function updateExtraField(
  draft: ContactDraft,
  index: number,
  patch: Partial<ExtraFieldRow>,
): ContactDraft {
  return {
    ...draft,
    extraFields: draft.extraFields.map((row, position) =>
      position === index ? {...row, ...patch} : row,
    ),
  };
}

export function removeExtraField(
  draft: ContactDraft,
  index: number,
): ContactDraft {
  return {
    ...draft,
    extraFields: draft.extraFields.filter(
      (_row, position) => position !== index,
    ),
  };
}
