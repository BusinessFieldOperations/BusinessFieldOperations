import {supabase} from '@/lib/supabase';

import {
  db,
  REFERENCE_META_KEY,
  REFERENCE_TABLE_NAMES,
  REFERENCE_TABLES,
  type ReferenceTableName,
} from './db';

/** PostgREST returns at most 1000 rows per request by default. */
const FETCH_PAGE_SIZE = 1000;

type AnyRow = Record<string, unknown>;

/** `[a+b]` -> ['a', 'b'], `id` -> ['id']. */
function keyColumns(primaryKey: string): string[] {
  return primaryKey.replace(/^\[|\]$/g, '').split('+');
}

async function fetchAllRows(
  table: ReferenceTableName,
  signal?: AbortSignal,
): Promise<AnyRow[]> {
  const orderColumns = keyColumns(REFERENCE_TABLES[table].primaryKey);
  const rows: AnyRow[] = [];

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    // Ordering by the primary key keeps the pages stable.
    let query = supabase.from(table).select('*');
    for (const column of orderColumns) {
      query = query.order(column, {ascending: true});
    }
    if (signal) {
      query = query.abortSignal(signal);
    }

    const {data, error} = await query.range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as unknown as AnyRow[];
    rows.push(...page);

    if (page.length < FETCH_PAGE_SIZE) {
      return rows;
    }
  }
}

async function runSync(userId: string, signal?: AbortSignal): Promise<number> {
  // Download everything first: if any request fails, local data is untouched.
  const downloaded = await Promise.all(
    REFERENCE_TABLE_NAMES.map(
      async name => [name, await fetchAllRows(name, signal)] as const,
    ),
  );

  const syncedAt = Date.now();
  const tables = REFERENCE_TABLE_NAMES.map(name => db.reference(name));

  // One transaction: observers see either the old data or the new data of all
  // tables, never a mix. Replacing (not merging) also removes rows deleted on
  // the server.
  await db.transaction('rw', [...tables, db.syncMeta], async () => {
    for (const [name, rows] of downloaded) {
      const table = db.table(name);
      await table.clear();
      await table.bulkAdd(rows);
    }
    await db.syncMeta.put({key: REFERENCE_META_KEY, userId, syncedAt});
  });

  return syncedAt;
}

let inFlight: Promise<number> | null = null;

/**
 * Copies all reference tables from Supabase into IndexedDB.
 *
 * Only one sync runs at a time: calling it again while one is in progress
 * returns the same promise. Resolves with the time of the sync (epoch ms).
 * Rejects (leaving the old local data untouched) when offline or on error.
 */
export function syncReferenceData(
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  if (!inFlight) {
    inFlight = runSync(userId, signal).finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

/** Empties the local copy of every reference table. */
export async function clearReferenceData(): Promise<void> {
  const tables = REFERENCE_TABLE_NAMES.map(name => db.reference(name));

  await db.transaction('rw', [...tables, db.syncMeta], async () => {
    for (const table of tables) {
      await table.clear();
    }
    await db.syncMeta.delete(REFERENCE_META_KEY);
  });
}

/**
 * Drops the local reference data if it was downloaded for a different user
 * (tasks are per user), so the new user never sees the previous one's data
 * while offline. Drafts and the outbox are not touched: they are filtered by
 * `ownerId` instead.
 */
export async function resetReferenceDataIfOtherUser(
  userId: string,
): Promise<void> {
  const meta = await db.syncMeta.get(REFERENCE_META_KEY);

  if (meta && meta.userId !== userId) {
    await clearReferenceData();
  }
}
