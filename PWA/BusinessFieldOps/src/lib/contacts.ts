import {db, type ReferenceRow} from '@/lib/offline/db';
import {describeDeliveryError} from '@/lib/offline/deliveryErrors';
import {listOutbox} from '@/lib/offline/outbox';
import type {OutboxItem} from '@/lib/offline/types';
import {useLiveQuery} from '@/lib/offline/useLiveQuery';
import {toPage, type Page, type PageRequest} from '@/lib/pagination';
import type {UserRole} from '@/lib/profiles';
import {normalizeSearchText} from '@/lib/useLocalSearch';

// ------------------------------------------------------------------ keys

/**
 * `?contact=<key>` identifies the contact to show:
 * `<ownerId>~<captured_at in ms>` for a contact that exists (sent or still on
 * this device: the key does not change when the outbox delivers it), or
 * `draft-<uuid>` for a new contact being written.
 *
 * `captured_at` is unique per owner, but an administrator can assign the same
 * contact (same `captured_at`) to several users, so the owner is part of it.
 */
export type ContactKeySource =
  | {source: 'draft'; id: string}
  | {source: 'contact'; ownerId: string; capturedMs: number};

export const contactKey = (ownerId: string, capturedAt: string) =>
  `${ownerId}~${Date.parse(capturedAt)}`;

export const draftContactKey = (draftId: string) => `draft-${draftId}`;

/**
 * `?contact=new`: the form for a new contact. It resumes the unfinished
 * draft if there is one, so "Add contact" never throws work away.
 */
export const NEW_CONTACT_KEY = 'new';

export function parseContactKey(key: string): ContactKeySource | null {
  if (key.startsWith('draft-') && key.length > 'draft-'.length) {
    return {source: 'draft', id: key.slice('draft-'.length)};
  }

  const match = /^([0-9a-f-]{36})~(\d+)$/i.exec(key);

  return match
    ? {source: 'contact', ownerId: match[1], capturedMs: Number(match[2])}
    : null;
}

// ----------------------------------------------------------------- model

/**
 * - `sent`: the server has it, with these values.
 * - `queued`: waiting on this device (a new contact or an edit).
 * - `failed`: the server refused it for good; needs the user.
 */
export type ContactStatus = 'sent' | 'queued' | 'failed';

/** A contact ready to display, wherever it currently lives. */
export interface ContactListItem {
  /** See {@link contactKey}. */
  key: string;
  /** Server id. `null` while the contact only exists on this device. */
  id: string | null;
  ownerId: string;
  /** Only known to administrators (profiles of others are not synced). */
  ownerName: string;
  createdBy: string;
  /** Created by an administrator for this owner (read-only for the owner). */
  assignedByAdmin: boolean;
  /** ISO-8601 time the contact was captured. Identifies it with its owner. */
  capturedAt: string;
  firstName: string;
  lastName: string;
  idDocument: string | null;
  email: string | null;
  /** Flat text values; other kinds of JSON values are shown as text. */
  extraFields: Record<string, string>;
  status: ContactStatus;
  /** Outbox item behind a `queued` or `failed` contact (new or edit). */
  outboxId: string | null;
  /** Why a `failed` contact was refused, in words. */
  errorMessage: string | null;
}

/** Who is looking: decides what is visible and editable. */
export interface ContactViewer {
  id: string;
  role: UserRole;
}

/**
 * How a contact is edited by this viewer:
 * - `queue`: their own contact, saved through the outbox (works offline).
 * - `direct`: an administrator editing somebody else's contact; goes straight
 *   to the server, so it needs a connection.
 * - `none`: read-only (a user looking at a contact an administrator assigned).
 */
export type ContactEditMode = 'queue' | 'direct' | 'none';

export function getContactEditMode(
  viewer: ContactViewer,
  contact: Pick<ContactListItem, 'ownerId' | 'createdBy'>,
): ContactEditMode {
  if (contact.ownerId === viewer.id && contact.createdBy === viewer.id) {
    return 'queue';
  }

  return viewer.role === 'administrator' ? 'direct' : 'none';
}

/** Only administrators delete, and only what the server already has. */
export const canDeleteContact = (
  viewer: ContactViewer,
  contact: Pick<ContactListItem, 'id'>,
): boolean => viewer.role === 'administrator' && contact.id !== null;

// --------------------------------------------------------------- helpers

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

function toExtraFields(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) =>
        ['string', 'number', 'boolean'].includes(typeof entry),
      )
      .map(([name, entry]) => [name, String(entry)]),
  );
}

type ContactFieldValues = Pick<
  ContactListItem,
  'firstName' | 'lastName' | 'idDocument' | 'email' | 'extraFields'
>;

/** The editable fields of a payload (`submit_contact`, `update_contact`). */
const fieldsFromPayload = (
  payload: Record<string, unknown>,
): ContactFieldValues => ({
  firstName: text(payload.first_name),
  lastName: text(payload.last_name),
  idDocument: textOrNull(payload.id_document),
  email: textOrNull(payload.email),
  extraFields: toExtraFields(payload.extra_fields),
});

const fromRow = (
  row: ReferenceRow<'contacts'>,
  ownerNames: ReadonlyMap<string, string>,
): ContactListItem => ({
  key: contactKey(row.owner_id, row.captured_at),
  id: row.id,
  ownerId: row.owner_id,
  ownerName: ownerNames.get(row.owner_id) ?? '',
  createdBy: row.created_by,
  assignedByAdmin: row.created_by !== row.owner_id,
  capturedAt: row.captured_at,
  firstName: row.first_name,
  lastName: row.last_name,
  idDocument: row.id_document,
  email: row.email,
  extraFields: toExtraFields(row.extra_fields),
  status: 'sent',
  outboxId: null,
  errorMessage: null,
});

/** Status of the item that is holding a contact back. */
const outboxState = (item: OutboxItem) => {
  const failed = item.status === 'failed';

  return {
    status: failed ? ('failed' as const) : ('queued' as const),
    outboxId: item.id,
    errorMessage: failed
      ? describeDeliveryError(item.lastError, item.kind)
      : null,
  };
};

/**
 * Puts what is still on this device on top of the server's contacts:
 * contacts waiting to be created, and edits waiting to be sent (their values
 * are shown, so the user sees what they typed until it is delivered).
 */
function applyOutbox(
  contacts: Map<string, ContactListItem>,
  outbox: readonly OutboxItem[],
  ownerNames: ReadonlyMap<string, string>,
): void {
  const waiting = outbox
    .filter(item => item.kind === 'contact' || item.kind === 'contact_update')
    .sort((first, second) => first.createdAt - second.createdAt);

  for (const item of waiting) {
    if (item.kind === 'contact') {
      const key = contactKey(item.ownerId, item.capturedAt);

      // Already back in the local data and about to leave the outbox: it must
      // not show up twice.
      if (!contacts.has(key)) {
        contacts.set(key, {
          key,
          id: null,
          ownerId: item.ownerId,
          ownerName: ownerNames.get(item.ownerId) ?? '',
          createdBy: item.ownerId,
          assignedByAdmin: false,
          capturedAt: item.capturedAt,
          ...fieldsFromPayload(item.payload),
          ...outboxState(item),
        });
      }
      continue;
    }

    const target = item.payload.contact_captured_at;
    const key =
      typeof target === 'string' ? contactKey(item.ownerId, target) : null;
    const current = key === null ? undefined : contacts.get(key);

    // An edit of a contact that is not in the local data (e.g. an
    // administrator deleted it) has nothing to show.
    if (key !== null && current) {
      contacts.set(key, {
        ...current,
        ...fieldsFromPayload(item.payload),
        ...outboxState(item),
      });
    }
  }
}

const byName = (first: ContactListItem, second: ContactListItem) =>
  `${first.lastName} ${first.firstName}`.localeCompare(
    `${second.lastName} ${second.firstName}`,
  ) ||
  Date.parse(second.capturedAt) - Date.parse(first.capturedAt) ||
  first.key.localeCompare(second.key);

/**
 * Every contact the viewer may see, from the local data (works offline), by
 * name. Mirrors the RLS rules: administrators see all cached rows, everybody
 * else only the contacts that belong to them.
 *
 * `ownerId` narrows it to one user (administrators; anybody else only ever
 * gets their own).
 */
async function loadContacts(
  viewer: ContactViewer,
  ownerId: string | null,
): Promise<ContactListItem[]> {
  const isAdmin = viewer.role === 'administrator';

  if (!isAdmin && ownerId !== null && ownerId !== viewer.id) {
    return [];
  }

  const scope = isAdmin ? ownerId : viewer.id;
  const table = db.reference('contacts');
  const [rows, outbox, profiles] = await Promise.all([
    scope === null
      ? table.toArray()
      : table.where('owner_id').equals(scope).toArray(),
    // The outbox is the viewer's own: it only matters when their contacts
    // are in scope.
    scope === null || scope === viewer.id
      ? listOutbox(viewer.id)
      : Promise.resolve<OutboxItem[]>([]),
    isAdmin
      ? db.reference('profiles').toArray()
      : Promise.resolve<ReferenceRow<'profiles'>[]>([]),
  ]);

  const ownerNames = new Map(
    profiles.map(profile => [
      profile.id,
      `${profile.first_name} ${profile.last_name}`.trim(),
    ]),
  );
  const contacts = new Map<string, ContactListItem>();

  for (const row of rows) {
    const contact = fromRow(row, ownerNames);
    contacts.set(contact.key, contact);
  }

  applyOutbox(contacts, outbox, ownerNames);

  return [...contacts.values()].sort(byName);
}

// ------------------------------------------------------------------ list

export interface ContactsPageRequest extends PageRequest {
  userId: string;
  role: UserRole;
  /**
   * Text to look for in name, document, email and (administrators) the
   * owner's name. Empty means no filter. Every word must match.
   */
  search?: string;
  /** Administrators: only the contacts of this user. */
  ownerId?: string | null;
}

/**
 * One page of the viewer's contacts, from the local data, by name.
 * Contacts that are still on this device are included.
 */
export async function getCachedContactsPage({
  offset,
  limit,
  userId,
  role,
  search = '',
  ownerId = null,
}: ContactsPageRequest): Promise<Page<ContactListItem>> {
  const contacts = await loadContacts({id: userId, role}, ownerId);
  const words = normalizeSearchText(search.trim()).split(/\s+/).filter(Boolean);

  const matching =
    words.length === 0
      ? contacts
      : contacts.filter(contact => {
          const haystack = normalizeSearchText(
            [
              contact.firstName,
              contact.lastName,
              contact.email,
              contact.idDocument,
              contact.ownerName,
            ]
              .filter(Boolean)
              .join(' '),
          );

          return words.every(word => haystack.includes(word));
        });

  return toPage(matching.slice(offset, offset + limit + 1), limit);
}

// ------------------------------------------------------------------ view

/**
 * The contact behind a `<ownerId>~<ms>` key, or `null` if it is not there (or
 * the viewer may not see it).
 */
export async function loadContactView(
  key: string,
  viewer: ContactViewer,
): Promise<ContactListItem | null> {
  const source = parseContactKey(key);

  if (!source || source.source !== 'contact') {
    return null;
  }

  const contacts = await loadContacts(viewer, source.ownerId);

  return (
    contacts.find(
      contact => Date.parse(contact.capturedAt) === source.capturedMs,
    ) ?? null
  );
}

/**
 * The contact behind a key. `undefined` while loading, `null` if it is not
 * available. Follows the local data (a queued contact turning into a sent
 * one, an edit being delivered...).
 */
export function useContactView(
  key: string,
  viewerId: string,
  role: UserRole,
): ContactListItem | null | undefined {
  return useLiveQuery(
    () => loadContactView(key, {id: viewerId, role}),
    [key, viewerId, role],
  );
}
