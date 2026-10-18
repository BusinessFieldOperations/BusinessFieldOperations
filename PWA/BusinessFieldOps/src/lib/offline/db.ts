import Dexie, {type Table} from 'dexie';

import type {Database} from '@/lib/database.types';

import type {Draft, OutboxItem, SyncMeta} from './types';

type PublicTables = Database['public']['Tables'];

interface ReferenceTableConfig {
  /** Dexie primary key. Compound keys look like `[client_id+state_id]`. */
  primaryKey: string;
  /** Extra Dexie indexes. Only index what you query by. */
  indexes?: readonly string[];
}

/**
 * Tables copied from Supabase so the app works offline (the single source of
 * truth: the Dexie schema and the sync both read this object).
 *
 * `satisfies` makes TypeScript reject a name that is not in
 * `database.types.ts`, which catches typos at compile time.
 *
 * To add a table (brands, categories...): add one line here. To add an index
 * to an existing table: add it here AND bump the `version()` number in
 * `AppDatabase` below, because IndexedDB only changes indexes in upgrades.
 * Note that IndexedDB cannot index null values.
 */
export const REFERENCE_TABLES = {
  brands: {primaryKey: 'name'},
  categories: {primaryKey: 'name'},
  states: {primaryKey: 'id'},
  profiles: {primaryKey: 'id'},
  legal_identity: {primaryKey: 'id'},
  clients: {primaryKey: 'id'},
  client_states: {
    primaryKey: '[client_id+state_id]',
    indexes: ['client_id', 'state_id'],
  },
  establishment: {primaryKey: 'id'},
  products: {primaryKey: 'id'},
  product_establishment: {
    primaryKey: '[product_id+establishment_id]',
    indexes: ['establishment_id'],
  },
  tasks: {primaryKey: 'id', indexes: ['assigned_to', 'establishment_id']},
  merchant_reports: {primaryKey: 'id', indexes: ['merchant_id', 'task_id']},
  merchant_report_salesfloors: {primaryKey: 'id', indexes: ['report_id']},
  merchant_report_inventory: {primaryKey: 'id', indexes: ['report_id']},
  promoter_reports: {primaryKey: 'id', indexes: ['promoter_id', 'task_id']},
  promoter_report_details: {
    primaryKey: '[report_id+product_id]',
    indexes: ['product_id', 'report_id'],
  },
  contacts: {primaryKey: 'id', indexes: ['owner_id']},
} as const satisfies Partial<Record<keyof PublicTables, ReferenceTableConfig>>;

export type ReferenceTableName = keyof typeof REFERENCE_TABLES;

/** Row type of a reference table, taken from the generated Supabase types. */
export type ReferenceRow<N extends ReferenceTableName> =
  N extends keyof PublicTables ? PublicTables[N]['Row'] : never;

export const REFERENCE_TABLE_NAMES = Object.keys(
  REFERENCE_TABLES,
) as ReferenceTableName[];

/** Key of the `syncMeta` row that describes the reference data. */
export const REFERENCE_META_KEY = 'reference';

function toSchema({primaryKey, indexes}: ReferenceTableConfig): string {
  return [primaryKey, ...(indexes ?? [])].join(', ');
}

const referenceSchemas = Object.fromEntries(
  REFERENCE_TABLE_NAMES.map(name => [name, toSchema(REFERENCE_TABLES[name])]),
);

// Clean it (is intended to run in a fresh db no under several patch)
const versionOneReferenceSchemas = {
  ...referenceSchemas,
  merchant_reports: toSchema({primaryKey: 'id'}),
  promoter_reports: toSchema({primaryKey: 'id'}),
};

const versionTwoReferenceSchemas = {
  ...referenceSchemas,
  merchant_reports: toSchema({primaryKey: 'id', indexes: ['merchant_id']}),
  promoter_reports: toSchema({primaryKey: 'id', indexes: ['promoter_id']}),
};

const beforeVersionFour = {
  merchant_report_salesfloors: toSchema({primaryKey: 'id'}),
  merchant_report_inventory: toSchema({primaryKey: 'id'}),
  promoter_report_details: toSchema({
    primaryKey: '[report_id+product_id]',
    indexes: ['product_id'],
  }),
};

class AppDatabase extends Dexie {
  syncMeta!: Table<SyncMeta, string>;
  drafts!: Table<Draft, string>;
  outbox!: Table<OutboxItem, string>;

  constructor() {
    super('business-field-ops');

    this.version(1).stores({
      ...versionOneReferenceSchemas,
      ...beforeVersionFour,
      syncMeta: 'key',
      drafts: 'id, ownerId, [ownerId+kind], [ownerId+kind+refId], updatedAt',
      outbox: 'id, ownerId, status, [ownerId+status], createdAt',
    });

    this.version(2).stores({
      ...versionTwoReferenceSchemas,
      ...beforeVersionFour,
      syncMeta: 'key',
      drafts: 'id, ownerId, [ownerId+kind], [ownerId+kind+refId], updatedAt',
      outbox: 'id, ownerId, status, [ownerId+status], createdAt',
    });
    this.version(3).stores({
      ...referenceSchemas,
      ...beforeVersionFour, // now with task_id
      syncMeta: 'key',
      drafts: 'id, ownerId, [ownerId+kind], [ownerId+kind+refId], updatedAt',
      outbox: 'id, ownerId, status, [ownerId+status], createdAt',
    });
    this.version(4).stores({
      ...referenceSchemas, // now with report_id on the child tables
      syncMeta: 'key',
      drafts: 'id, ownerId, [ownerId+kind], [ownerId+kind+refId], updatedAt',
      outbox: 'id, ownerId, status, [ownerId+status], createdAt',
    });
  }

  /** Typed access to a reference table by name. */
  reference<N extends ReferenceTableName>(
    name: N,
  ): Table<ReferenceRow<N>, IDBValidKey> {
    return this.table(name);
  }
}

export const db = new AppDatabase();

/**
 * Asks the browser not to evict the local data under storage pressure.
 * Call it once after login. Returns whether storage is now persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false;
  }

  if (await navigator.storage.persisted()) {
    return true;
  }

  return navigator.storage.persist();
}
