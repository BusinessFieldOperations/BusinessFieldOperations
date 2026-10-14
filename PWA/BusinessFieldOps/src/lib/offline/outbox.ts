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
