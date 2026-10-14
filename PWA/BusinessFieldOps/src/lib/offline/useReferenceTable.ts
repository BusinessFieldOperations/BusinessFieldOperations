import {db, type ReferenceRow, type ReferenceTableName} from './db';
import {useLiveQuery} from './useLiveQuery';

/**
 * All rows of a local reference table, typed from `database.types.ts`.
 * `undefined` until the first read finishes; `[]` if nothing is synced yet.
 *
 * @example
 * const products = useReferenceTable('products');
 */
export function useReferenceTable<N extends ReferenceTableName>(
  name: N,
): ReferenceRow<N>[] | undefined {
  return useLiveQuery(() => db.reference(name).toArray(), [name]);
}
