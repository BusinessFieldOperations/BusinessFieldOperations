/** Default number of rows requested per page. */
export const PAGE_SIZE = 10;

/** One page of results. */
export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

/** What every paged fetcher receives from `usePagedList`. */
export interface PageRequest {
  offset: number;
  limit: number;
  signal: AbortSignal;
}

/**
 * Turns the rows of a `limit + 1` query into a page.
 *
 * Fetch `.range(offset, offset + limit)` (that is `limit + 1` rows): if the
 * extra row came back there is at least one more page, and it is dropped here.
 */
export function toPage<T>(rows: readonly T[] | null, limit: number): Page<T> {
  const safeRows = rows ?? [];

  return {
    items: safeRows.slice(0, limit),
    hasMore: safeRows.length > limit,
  };
}

/**
 * Builds a `%term%` pattern for `ilike`, escaping the `%`, `_` and `\`
 * characters so the user's text is matched literally.
 */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}
