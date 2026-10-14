import {useCallback, useEffect, useRef, useState} from 'preact/hooks';

import {PAGE_SIZE, type Page, type PageRequest} from './pagination';

/**
 * - `loading`: first page (or a reset, e.g. new search term) in flight.
 * - `loadingMore`: next page in flight, current items stay visible.
 * - `error`: last request failed, current items stay visible.
 */
export type PagedListStatus = 'idle' | 'loading' | 'loadingMore' | 'error';

/** Options of {@link usePagedList}. */
export interface UsePagedListOptions<T> {
  /** Rows per page. */
  pageSize?: number;
  /** While false nothing is fetched and the list stays empty. */
  enabled?: boolean;
  /**
   * Stable unique key of an item. When given, items already received are
   * skipped, which protects against duplicates if rows are inserted while the
   * user scrolls (offset pagination drifts).
   */
  getKey?: (_item: T) => string | number;
}

/** Value returned by {@link usePagedList}. */
export interface PagedList<T> {
  items: T[];
  status: PagedListStatus;
  hasMore: boolean;
  /** Loads the next page. Ignored while another request is in flight. */
  loadMore: () => void;
  /** Starts again from the first page. */
  reload: () => void;
  /** Repeats the request that failed. */
  retry: () => void;
}

/**
 * Offset-paginated list with abortable requests.
 *
 * Whenever `fetchPage` changes identity (wrap it in `useCallback` and list the
 * filters it uses as dependencies) the list resets and the in-flight request
 * is cancelled, so a slow old response can never overwrite a newer one.
 */
export function usePagedList<T>(
  fetchPage: (_request: PageRequest) => Promise<Page<T>>,
  {pageSize = PAGE_SIZE, enabled = true, getKey}: UsePagedListOptions<T> = {},
): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<PagedListStatus>('loading');
  const [hasMore, setHasMore] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const keysRef = useRef(new Set<string | number>());
  const getKeyRef = useRef(getKey);
  getKeyRef.current = getKey;

  const clear = useCallback(() => {
    offsetRef.current = 0;
    hasMoreRef.current = false;
    keysRef.current.clear();
    setItems([]);
    setHasMore(false);
  }, []);

  const load = useCallback(
    async (reset: boolean) => {
      if (!reset && (controllerRef.current || !hasMoreRef.current)) {
        return;
      }

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      if (reset) {
        clear();
      }
      setStatus(reset ? 'loading' : 'loadingMore');

      try {
        const page = await fetchPage({
          offset: offsetRef.current,
          limit: pageSize,
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        // The server offset advances by what it returned, not by what is kept.
        offsetRef.current += page.items.length;
        hasMoreRef.current = page.hasMore;

        const keyOf = getKeyRef.current;
        const fresh = keyOf
          ? page.items.filter(item => {
              const key = keyOf(item);
              if (keysRef.current.has(key)) {
                return false;
              }
              keysRef.current.add(key);
              return true;
            })
          : page.items;

        setItems(previous => [...previous, ...fresh]);
        setHasMore(page.hasMore);
        setStatus('idle');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('Failed to load page', error);
        setStatus('error');
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    },
    [fetchPage, pageSize, clear],
  );

  useEffect(() => {
    if (!enabled) {
      clear();
      setStatus('idle');
      return;
    }

    void load(true);

    return () => controllerRef.current?.abort();
  }, [enabled, load, clear]);

  const loadMore = useCallback(() => void load(false), [load]);
  const reload = useCallback(() => void load(true), [load]);
  const retry = useCallback(() => void load(offsetRef.current === 0), [load]);

  return {items, status, hasMore, loadMore, reload, retry};
}
