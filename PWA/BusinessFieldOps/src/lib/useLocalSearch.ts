import {useMemo, useState} from 'preact/hooks';

import {useDebouncedValue} from './useDebouncedValue';

export type SearchableText = string | null | undefined;

/** Lowercase and without accents, so "limon" finds "Limón". */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Value returned by {@link useLocalSearch}. */
export interface LocalSearch<T> {
  query: string;
  setQuery: (_value: string) => void;
  /**
   * Items that contain every word of the query (any order, any field).
   * All items when the query is empty; `undefined` while `items` is.
   */
  results: readonly T[] | undefined;
}

/**
 * Filters an in-memory list (e.g. rows of a local reference table).
 *
 * `getTexts` lists the fields to search; pass a module-level function or a
 * `useCallback`, because a new function every render rebuilds the index.
 * Apply other filters (brand, category) BEFORE passing `items`.
 *
 * @example
 * const getTexts = (p: Product) => [p.name, p.sku, p.display_quantity, p.brand];
 * const {query, setQuery, results} = useLocalSearch(products, getTexts);
 */
export function useLocalSearch<T>(
  items: readonly T[] | undefined,
  getTexts: (_item: T) => readonly SearchableText[],
  delayMs = 150,
): LocalSearch<T> {
  const [query, setQuery] = useState('');
  const term = useDebouncedValue(normalizeSearchText(query.trim()), delayMs);

  const haystacks = useMemo(
    () =>
      items?.map(item =>
        normalizeSearchText(getTexts(item).filter(Boolean).join(' ')),
      ),
    [items, getTexts],
  );

  const results = useMemo(() => {
    if (!items || !haystacks || term === '') {
      return items;
    }

    const words = term.split(/\s+/);

    return items.filter((_item, index) =>
      words.every(word => haystacks[index].includes(word)),
    );
  }, [items, haystacks, term]);

  return {query, setQuery, results};
}
