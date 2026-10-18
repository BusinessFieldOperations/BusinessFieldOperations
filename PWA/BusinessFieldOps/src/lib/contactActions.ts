import type {Json} from '@/lib/database.types';
import type {ContactFields} from '@/lib/contactPayloads';
import {db} from '@/lib/offline/db';
import {discardContactItems} from '@/lib/offline/outbox';
import {syncReferenceData} from '@/lib/offline/referenceData';
import {supabase} from '@/lib/supabase';

/** The action goes straight to the server and there is no connection. */
export class ContactNeedsConnectionError extends Error {
  constructor() {
    super('contact_needs_connection');
    this.name = 'ContactNeedsConnectionError';
  }
}

/** A selected user does not exist or is not active anymore. */
export class ContactRecipientError extends Error {
  constructor() {
    super('unknown_recipient');
    this.name = 'ContactRecipientError';
  }
}

/**
 * Turns a failed request into the right error. supabase-js reports a lost
 * connection with an empty code; everything else is the server's answer.
 */
function failure(error: {code?: string | null; message: string}): unknown {
  if (!error.code) {
    return new ContactNeedsConnectionError();
  }

  if (error.message === 'unknown_recipient') {
    return new ContactRecipientError();
  }

  return error;
}

/**
 * Edits a contact that belongs to somebody else (administrators only, RLS
 * decides). It does not go through the outbox: the owner's own edits do, an
 * administrator's changes need a connection.
 *
 * On success the local copy is updated too, so the lists show the new values
 * at once; the next sync only refreshes `updated_at`.
 */
export async function updateContactDirect(
  contactId: string,
  fields: ContactFields,
): Promise<void> {
  if (!navigator.onLine) {
    throw new ContactNeedsConnectionError();
  }

  const {data, error} = await supabase
    .from('contacts')
    .update(fields)
    .eq('id', contactId)
    .select('id');

  if (error) {
    throw failure(error);
  }

  // RLS hides rows it does not allow instead of failing.
  if (!data || data.length === 0) {
    throw new Error('The contact does not exist or cannot be edited.');
  }

  await db.reference('contacts').update(contactId, fields);
}

// -------------------------------------------------------------- assigning

/** Input of {@link assignContact}. */
export interface AssignContactInput {
  /** The administrator (their local copy is refreshed afterwards). */
  userId: string;
  /**
   * `captured_at` of the contact. Take it ONCE, at the first attempt, and
   * resend the same value on a retry: it is the idempotency key, so a retry
   * after a lost answer never creates the contact twice.
   */
  capturedAt: string;
  fields: ContactFields;
  /** Profile ids that receive their own copy of the contact. */
  ownerIds: readonly string[];
}

export interface AssignContactResult {
  /** Copies created now. */
  created: number;
  /** Recipients that already had it (a retry). */
  skipped: number;
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

function parseAssignResult(data: Json | null): AssignContactResult {
  const result =
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? data
      : {};

  return {created: count(result.created), skipped: count(result.skipped)};
}

/**
 * Downloads the server's data until the new copies are in the local data. A
 * sync that was already running may have started before the server had them,
 * so it looks once more.
 */
async function syncUntilPresent(
  userId: string,
  ownerId: string,
  capturedAt: string,
): Promise<void> {
  const targetMs = Date.parse(capturedAt);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await syncReferenceData(userId);
    } catch (error) {
      console.warn('Sync after assigning a contact failed', error);
      return;
    }

    const rows = await db
      .reference('contacts')
      .where('owner_id')
      .equals(ownerId)
      .toArray();

    if (rows.some(row => Date.parse(row.captured_at) === targetMs)) {
      return;
    }
  }
}

/**
 * Administrators only: gives the same contact to one or several users (one
 * independent copy each; only an administrator can edit them). It needs a
 * connection, so it does not use the outbox.
 */
export async function assignContact({
  userId,
  capturedAt,
  fields,
  ownerIds,
}: AssignContactInput): Promise<AssignContactResult> {
  if (!navigator.onLine) {
    throw new ContactNeedsConnectionError();
  }

  const {data, error} = await supabase.rpc('assign_contact', {
    p_contact: {...fields, captured_at: capturedAt},
    p_owner_ids: [...ownerIds],
  });

  if (error) {
    throw failure(error);
  }

  // The lists show them once the sync lands; the dialog does not wait for it.
  void syncUntilPresent(userId, ownerIds[0], capturedAt).catch(cause =>
    console.warn('Sync after assigning a contact failed', cause),
  );

  return parseAssignResult(data);
}

// -------------------------------------------------------------- deleting

/**
 * Deletes a contact on the server (administrators only, RLS decides). Needs a
 * connection. Call {@link forgetContactLocally} afterwards.
 */
export async function deleteContactRemote(contactId: string): Promise<void> {
  if (!navigator.onLine) {
    throw new ContactNeedsConnectionError();
  }

  const {data, error} = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .select('id');

  if (error) {
    throw failure(error);
  }

  // RLS hides rows it does not allow instead of failing.
  if (!data || data.length === 0) {
    throw new Error('The contact does not exist or cannot be deleted.');
  }
}

/** What a deleted contact leaves behind on this device. */
export interface ForgetContactInput {
  contactId: string;
  ownerId: string;
  capturedAt: string;
  /** The signed-in user: only their own outbox is touched. */
  viewerId: string;
}

/**
 * Removes a deleted contact from the local data, and the items of the
 * viewer's own outbox that were waiting for it. Kept apart from the delete so
 * the dialog can close before the lists change under it.
 */
export async function forgetContactLocally({
  contactId,
  ownerId,
  capturedAt,
  viewerId,
}: ForgetContactInput): Promise<void> {
  await db.reference('contacts').delete(contactId);

  if (ownerId === viewerId) {
    await discardContactItems(viewerId, capturedAt);
  }
}
