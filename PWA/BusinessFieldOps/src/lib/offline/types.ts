/** Kinds of records the user can create while offline. */
export type OfflineKind = 'merchant_report' | 'promoter_report' | 'contact';

/** A work-in-progress form, saved locally until the user presses Send. */
export interface Draft<T = unknown> {
  /** Local UUID. It becomes the outbox item id when the draft is sent. */
  id: string;
  kind: OfflineKind;
  /** Profile id of the user who is writing it. */
  ownerId: string;
  /**
   * What the draft is about (e.g. a task id), so it can be found again.
   * Empty string when it is about nothing in particular: IndexedDB cannot
   * index `null`, so an empty string keeps the compound index usable.
   */
  refId: string;
  data: T;
  createdAt: number;
  updatedAt: number;
}

/**
 * - `pending`: waiting to be sent (or to be retried after `nextAttemptAt`).
 * - `sending`: a sender took it. If the app closes now it goes back to
 *   `pending` on the next start; the server's idempotency makes that safe.
 * - `failed`: rejected for good (task gone, invalid data...). Needs the user.
 */
export type OutboxStatus = 'pending' | 'sending' | 'failed';

export interface OutboxError {
  /** Postgres / PostgREST error code, or null for non-database errors. */
  code: string | null;
  message: string;
}

/** A finished record waiting to reach the server. */
export interface OutboxItem {
  /** Local UUID (the draft id when it came from a draft). */
  id: string;
  kind: OfflineKind;
  ownerId: string;
  /** ISO-8601 with milliseconds. Frozen: retries must send the same value. */
  capturedAt: string;
  /** Exactly what is sent to the `submit_*` function (includes captured_at). */
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  lastError: OutboxError | null;
  createdAt: number;
  updatedAt: number;
  /** Epoch ms. A pending item is not tried before this moment. */
  nextAttemptAt: number;
}

/** Bookkeeping about the last reference-data sync. */
export interface SyncMeta {
  key: string;
  /** User the local reference data belongs to (tasks are per user). */
  userId: string;
  /** Epoch ms of the last completed sync. */
  syncedAt: number;
}
