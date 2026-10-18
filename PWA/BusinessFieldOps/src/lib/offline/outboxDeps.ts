import type {Json} from '@/lib/database.types';
import {supabase} from '@/lib/supabase';

import {db} from './db';
import {
  claim,
  complete,
  getNextPending,
  markFailed,
  release,
  retryDelayMs,
} from './outbox';
import type {SenderDeps} from './outboxSender';
import {syncReferenceData} from './referenceData';
import type {OfflineKind, OutboxItem} from './types';

type Submitter = (
  _payload: Json,
) => PromiseLike<{error: {code?: string | null; message: string} | null}>;

/** The `submit_*` function each kind of record goes through. */
const SUBMITTERS: Record<OfflineKind, Submitter> = {
  merchant_report: payload =>
    supabase.rpc('submit_merchant_report', {p_report: payload}),
  promoter_report: payload =>
    supabase.rpc('submit_promoter_report', {p_report: payload}),
  contact: payload => supabase.rpc('submit_contact', {p_contact: payload}),
  contact_update: payload =>
    supabase.rpc('update_contact', {p_contact: payload}),
};

const LOCK_NAME = 'business-field-ops-outbox';

/** One sender at a time across tabs; without Web Locks, one per tab. */
async function withLock(task: () => Promise<void>): Promise<boolean> {
  if (!navigator.locks) {
    await task();
    return true;
  }

  return navigator.locks.request(LOCK_NAME, {ifAvailable: true}, async lock => {
    if (!lock) {
      return false;
    }

    await task();
    return true;
  });
}

const sameOrNull = (first: unknown, second: unknown) =>
  (first ?? null) === (second ?? null);

/**
 * Whether the contact of an outbox item came back in the local data: for a
 * new contact, that it exists; for an edit, that the local copy has the
 * edited values.
 */
async function isContactCached(item: OutboxItem): Promise<boolean> {
  const target =
    item.kind === 'contact'
      ? item.capturedAt
      : item.payload.contact_captured_at;

  if (typeof target !== 'string') {
    return true;
  }

  const targetMs = Date.parse(target);
  const rows = await db
    .reference('contacts')
    .where('owner_id')
    .equals(item.ownerId)
    .toArray();
  const row = rows.find(
    contact => Date.parse(contact.captured_at) === targetMs,
  );

  if (!row) {
    return false;
  }

  if (item.kind === 'contact') {
    return true;
  }

  // extra_fields is not compared: jsonb does not keep the order of the keys.
  return (
    row.first_name === item.payload.first_name &&
    row.last_name === item.payload.last_name &&
    sameOrNull(row.id_document, item.payload.id_document) &&
    sameOrNull(row.email, item.payload.email)
  );
}

/** Whether the server's copy of the record of an item is in the local data. */
async function isCached(item: OutboxItem): Promise<boolean> {
  if (item.kind === 'contact' || item.kind === 'contact_update') {
    return isContactCached(item);
  }

  const taskId = item.payload.task_id;

  if (
    (item.kind !== 'merchant_report' && item.kind !== 'promoter_report') ||
    typeof taskId !== 'string'
  ) {
    return true;
  }

  const table =
    item.kind === 'merchant_report' ? 'merchant_reports' : 'promoter_reports';
  const rows = await db
    .reference(table)
    .where('task_id')
    .equals(taskId)
    .toArray();
  const capturedAt = Date.parse(item.capturedAt);

  return rows.some(row => Date.parse(row.captured_at) === capturedAt);
}

/** The real thing: IndexedDB, Supabase and the browser. */
export const outboxDeps: SenderDeps = {
  getNextPending,
  claim,
  release,
  markFailed,
  complete,
  listPending: ownerId =>
    db.outbox.where('[ownerId+status]').equals([ownerId, 'pending']).toArray(),
  submit: item => SUBMITTERS[item.kind](item.payload as Json),
  syncReferenceData: ownerId => syncReferenceData(ownerId),
  isCached,
  retryDelayMs,
  now: () => Date.now(),
  withLock,
};
