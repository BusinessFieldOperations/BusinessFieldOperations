import {db} from './db';
import type {OfflineKind, OutboxError, OutboxItem} from './types';

const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

/** Wait before retrying an item that already failed `attempts` times. */
export function retryDelayMs(attempts: number): number {
  return Math.min(1000 * 2 ** attempts, MAX_RETRY_DELAY_MS);
}

/** Input of {@link enqueue}. */
export interface EnqueueInput {
  kind: OfflineKind;
  ownerId: string;
  /** The record to send, in the shape the `submit_*` function expects. */
  payload: Record<string, unknown>;
  /** The draft it comes from: deleted in the same transaction. */
  draftId?: string;
}

/**
 * Moves a finished record into the outbox.
 *
 * In ONE transaction it stamps `captured_at` (the idempotency key, frozen
 * from now on), stores the item as pending and deletes the draft. If the
 * app dies halfway, the user still has the draft or the queued item, never
 * neither. Calling it twice with the same `draftId` (double tap) returns the
 * item that already exists instead of queuing a second report.
 */
export async function enqueue({
  kind,
  ownerId,
  payload,
  draftId,
}: EnqueueInput): Promise<OutboxItem> {
  return db.transaction('rw', db.outbox, db.drafts, async () => {
    const id = draftId ?? crypto.randomUUID();
    const existing = await db.outbox.get(id);

    if (existing) {
      return existing;
    }

    const now = Date.now();
    const capturedAt = new Date(now).toISOString();
    const item: OutboxItem = {
      id,
      kind,
      ownerId,
      capturedAt,
      payload: {...payload, captured_at: capturedAt},
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      nextAttemptAt: now,
    };

    await db.outbox.add(item);
    if (draftId) {
      await db.drafts.delete(draftId);
    }

    return item;
  });
}

/** The edit cannot be queued while the contact is being sent: try again. */
export class ContactSendingError extends Error {
  constructor() {
    super('contact_sending');
    this.name = 'ContactSendingError';
  }
}

/** Input of {@link queueContactUpdate}. */
export interface QueueContactUpdateInput {
  /** Profile id of the signed-in user (the contact's owner). */
  ownerId: string;
  /**
   * `captured_at` of the contact being edited, as the server or the outbox
   * has it. It identifies the contact: a contact created offline has no
   * server id yet.
   */
  contactCapturedAt: string;
  /** ALL the editable fields, in the shape `update_contact` expects. */
  fields: Record<string, unknown>;
}

const outboxTargetsContact = (item: OutboxItem, targetMs: number): boolean => {
  if (item.kind === 'contact') {
    return Date.parse(item.capturedAt) === targetMs;
  }

  return (
    item.kind === 'contact_update' &&
    Date.parse(String(item.payload.contact_captured_at)) === targetMs
  );
};

/**
 * Queues the edit of one of the user's own contacts, in ONE transaction.
 *
 * - The contact is still waiting to be created (`pending` or `failed`): the
 *   edit goes into that item, so the server only ever sees the final values
 *   and an edit can never reach the server before its contact does. A failed
 *   item goes back to pending: the user has just changed it.
 * - The contact already has a waiting edit: its fields are replaced, so many
 *   edits become one `update_contact` call.
 * - Otherwise a new `contact_update` item is added.
 *
 * Throws {@link ContactSendingError} if an item of that contact is being sent
 * right now (a few seconds at most): a retry of the item in flight could
 * overwrite a newer edit, so the caller shows "try again in a moment".
 */
export async function queueContactUpdate({
  ownerId,
  contactCapturedAt,
  fields,
}: QueueContactUpdateInput): Promise<OutboxItem> {
  return db.transaction('rw', db.outbox, async () => {
    const targetMs = Date.parse(contactCapturedAt);
    const related = (await db.outbox.where('ownerId').equals(ownerId).toArray())
      .filter(item => outboxTargetsContact(item, targetMs))
      .sort((first, second) => first.createdAt - second.createdAt);

    if (related.some(item => item.status === 'sending')) {
      throw new ContactSendingError();
    }

    const now = Date.now();
    const waiting =
      related.find(item => item.kind === 'contact') ??
      related.find(item => item.kind === 'contact_update');

    if (waiting) {
      const merged: OutboxItem = {
        ...waiting,
        payload: {...waiting.payload, ...fields},
        status: 'pending',
        lastError: null,
        updatedAt: now,
        nextAttemptAt: now,
      };
      await db.outbox.put(merged);

      return merged;
    }

    const item: OutboxItem = {
      id: crypto.randomUUID(),
      kind: 'contact_update',
      ownerId,
      capturedAt: new Date(now).toISOString(),
      payload: {...fields, contact_captured_at: contactCapturedAt},
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      nextAttemptAt: now,
    };
    await db.outbox.add(item);

    return item;
  });
}

/**
 * Drops what is still waiting to be sent for a contact that was deleted, so
 * no item is left behind that could only fail.
 */
export async function discardContactItems(
  ownerId: string,
  contactCapturedAt: string,
): Promise<void> {
  const targetMs = Date.parse(contactCapturedAt);

  await db.transaction('rw', db.outbox, async () => {
    const items = await db.outbox.where('ownerId').equals(ownerId).toArray();

    for (const item of items) {
      if (outboxTargetsContact(item, targetMs)) {
        await db.outbox.delete(item.id);
      }
    }
  });
}

/** All outbox items of a user, oldest first (for the "pending" screen). */
export async function listOutbox(ownerId: string): Promise<OutboxItem[]> {
  return db.outbox.where('ownerId').equals(ownerId).sortBy('createdAt');
}

/** The oldest pending item that is due to be tried, if any. */
export async function getNextPending(
  ownerId: string,
): Promise<OutboxItem | undefined> {
  const now = Date.now();
  const pending = await db.outbox
    .where('[ownerId+status]')
    .equals([ownerId, 'pending'])
    .sortBy('createdAt');

  return pending.find(item => item.nextAttemptAt <= now);
}

/**
 * Takes an item for sending (pending -> sending). Returns undefined if it is
 * not pending any more, e.g. another tab took it first, so two senders never
 * work on the same item.
 */
export async function claim(id: string): Promise<OutboxItem | undefined> {
  return db.transaction('rw', db.outbox, async () => {
    const item = await db.outbox.get(id);

    if (!item || item.status !== 'pending') {
      return undefined;
    }

    const claimed: OutboxItem = {
      ...item,
      status: 'sending',
      attempts: item.attempts + 1,
      updatedAt: Date.now(),
    };
    await db.outbox.put(claimed);

    return claimed;
  });
}

/** The send failed for a temporary reason: back to pending, retry later. */
export async function release(id: string, error: OutboxError): Promise<void> {
  await db.transaction('rw', db.outbox, async () => {
    const item = await db.outbox.get(id);

    if (!item) {
      return;
    }

    const now = Date.now();
    await db.outbox.put({
      ...item,
      status: 'pending',
      lastError: error,
      updatedAt: now,
      nextAttemptAt: now + retryDelayMs(item.attempts),
    });
  });
}

/** The server (or a pre-check) rejected it for good. Needs the user. */
export async function markFailed(
  id: string,
  error: OutboxError,
): Promise<void> {
  await db.outbox.update(id, {
    status: 'failed',
    lastError: error,
    updatedAt: Date.now(),
  });
}

/** The server has it: remove it from the outbox. */
export async function complete(id: string): Promise<void> {
  await db.outbox.delete(id);
}

/** The user wants to try a failed item again. */
export async function retryFailed(id: string): Promise<void> {
  const now = Date.now();

  await db.outbox
    .where('id')
    .equals(id)
    .and(item => item.status === 'failed')
    .modify({status: 'pending', updatedAt: now, nextAttemptAt: now});
}

/** The user gives up on an item. */
export async function discard(id: string): Promise<void> {
  await db.outbox.delete(id);
}

/**
 * Items left in `sending` by a closed or crashed app go back to pending. The
 * server's idempotency (owner + captured_at) makes the resend safe even if
 * the first attempt did arrive.
 */
export async function recoverInterrupted(): Promise<void> {
  await db.outbox.where('status').equals('sending').modify({
    status: 'pending',
    updatedAt: Date.now(),
    nextAttemptAt: Date.now(),
  });
}
