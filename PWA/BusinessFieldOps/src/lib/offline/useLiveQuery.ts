import {liveQuery} from 'dexie';
import {useEffect, useRef, useState} from 'preact/hooks';

/**
 * Runs a Dexie query and re-renders whenever the data it reads changes, also
 * when another tab or the sync writes it.
 *
 * Returns `undefined` until the first result arrives (unless `initialValue`
 * is given). Pass in `deps` the values the query uses (like `useEffect`).
 *
 * @example
 * const products = useLiveQuery(() => db.reference('products').toArray(), []);
 */
export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps: readonly unknown[],
  initialValue: T,
): T;
export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps?: readonly unknown[],
): T | undefined;
export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps: readonly unknown[] = [],
  initialValue?: T,
): T | undefined {
  const [value, setValue] = useState<T | undefined>(initialValue);
  const querierRef = useRef(querier);
  querierRef.current = querier;

  useEffect(() => {
    const subscription = liveQuery(() => querierRef.current()).subscribe({
      next: result => setValue(result),
      error: error => console.error('Live query failed', error),
    });

    return () => subscription.unsubscribe();
  }, deps);

  return value;
}
