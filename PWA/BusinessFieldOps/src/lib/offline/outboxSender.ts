import {isFinalError} from './deliveryErrors';
import type {OutboxError, OutboxItem} from './types';

/** Wait before looking again when another tab holds the sender lock. */
const LOCK_RETRY_MS = 3000;
/** Margin so a timer set for `nextAttemptAt` fires once the item is due. */
const DUE_MARGIN_MS = 50;

/**
 * Everything the sender touches. Injected so the logic can be tested without
 * IndexedDB or a network; `outboxDeps.ts` wires the real ones.
 */
export interface SenderDeps {
  getNextPending: (_ownerId: string) => Promise<OutboxItem | undefined>;
  claim: (_id: string) => Promise<OutboxItem | undefined>;
  release: (_id: string, _error: OutboxError) => Promise<void>;
  markFailed: (_id: string, _error: OutboxError) => Promise<void>;
  complete: (_id: string) => Promise<void>;
  listPending: (_ownerId: string) => Promise<OutboxItem[]>;
  /** Calls the `submit_*` function of the item's kind. */
  submit: (
    _item: OutboxItem,
  ) => PromiseLike<{error: {code?: string | null; message: string} | null}>;
  /** Downloads the server's data again. Rejects when offline. */
  syncReferenceData: (_ownerId: string) => Promise<unknown>;
  /** Whether the server's copy of the record is in the local data. */
  isCached: (_item: OutboxItem) => Promise<boolean>;
  retryDelayMs: (_attempts: number) => number;
  now: () => number;
  /** Runs the task if no other tab is sending; resolves whether it ran. */
  withLock: (_task: () => Promise<void>) => Promise<boolean>;
}

/** Value returned by {@link createOutboxSender}. */
export interface OutboxSender {
  /** Looks for work now (a new item, the app visible again...). */
  kick: () => void;
  /** Like `kick`, after forgetting a pause caused by a lost connection. */
  resume: () => void;
  stop: () => void;
  /** One pass over the items that are due. Resolves when it ends (tests). */
  runOnce: () => Promise<void>;
}

type Outcome = 'sent' | 'failed' | 'retry' | 'offline';

/**
 * Delivers the outbox of one user, one item at a time, oldest first.
 *
 * - The server's answer decides: success, refused for good (`failed`, the
 *   user decides), or temporary (back to `pending` with a growing delay).
 * - No connection stops the pass: the rest would fail the same way.
 * - After delivering, the local copy of the server's data is refreshed
 *   BEFORE the items leave the outbox, so a report never disappears from the
 *   lists in between.
 * - Resending is safe: `submit_*` is idempotent (owner + `captured_at`).
 */
export function createOutboxSender(
  ownerId: string,
  deps: SenderDeps,
): OutboxSender {
  let stopped = false;
  let running = false;
  let lockMissed = false;
  let pausedUntil = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const deliver = async (item: OutboxItem): Promise<Outcome> => {
    let error: OutboxError;

    try {
      const response = await deps.submit(item);

      if (!response.error) {
        return 'sent';
      }

      error = {
        code: response.error.code || null,
        message: response.error.message,
      };
    } catch (cause) {
      error = {
        code: null,
        message: cause instanceof Error ? cause.message : String(cause),
      };
    }

    if (isFinalError(error.code)) {
      await deps.markFailed(item.id, error);
      return 'failed';
    }

    await deps.release(item.id, error);

    // supabase-js reports a lost connection with an empty code.
    return error.code === null ? 'offline' : 'retry';
  };

  const settle = async (items: OutboxItem[]) => {
    // A sync that was already running may have started before the server got
    // these records: look again once if they are not in the local data.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await deps.syncReferenceData(ownerId);
      } catch (error) {
        console.warn('Sync after sending failed', error);
        break;
      }

      if ((await Promise.all(items.map(deps.isCached))).every(Boolean)) {
        break;
      }
    }

    for (const item of items) {
      await deps.complete(item.id);
    }
  };

  const drain = async () => {
    const delivered: OutboxItem[] = [];
    let lostClaim: string | null = null;

    while (!stopped && deps.now() >= pausedUntil) {
      const next = await deps.getNextPending(ownerId);

      if (!next) {
        break;
      }

      const item = await deps.claim(next.id);

      // Another tab took it first: look at the next one. If the same item
      // keeps coming back, something is off: end the pass instead of spinning.
      if (!item) {
        if (lostClaim === next.id) {
          break;
        }

        lostClaim = next.id;
        continue;
      }

      const outcome = await deliver(item);

      if (outcome === 'sent') {
        delivered.push(item);
      } else if (outcome === 'offline') {
        pausedUntil = deps.now() + deps.retryDelayMs(item.attempts);
        break;
      }
    }

    if (delivered.length > 0) {
      await settle(delivered);
    }
  };

  const runOnce = async () => {
    if (stopped || running) {
      return;
    }

    running = true;

    try {
      lockMissed = !(await deps.withLock(drain));
    } catch (error) {
      console.error('Outbox pass failed', error);
    } finally {
      running = false;
    }
  };

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  // After a pass: wake up when the next pending item is due.
  const schedule = async () => {
    clearTimer();

    if (stopped) {
      return;
    }

    let delay: number;

    if (lockMissed) {
      delay = LOCK_RETRY_MS;
    } else {
      const pending = await deps.listPending(ownerId);

      if (pending.length === 0) {
        return;
      }

      const earliest = Math.min(...pending.map(item => item.nextAttemptAt));

      delay = Math.max(Math.max(earliest, pausedUntil) - deps.now(), 0);
    }

    timer = setTimeout(() => {
      timer = null;
      void run();
    }, delay + DUE_MARGIN_MS);
  };

  const run = async () => {
    // A pass in progress picks up new items by itself and schedules after.
    if (stopped || running) {
      return;
    }

    await runOnce();

    try {
      await schedule();
    } catch (error) {
      console.error('Outbox scheduling failed', error);
    }
  };

  return {
    kick: () => void run(),
    resume: () => {
      pausedUntil = 0;
      void run();
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
    runOnce,
  };
}
