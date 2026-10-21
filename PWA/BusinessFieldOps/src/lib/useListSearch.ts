import {useCallback, useState} from 'preact/hooks';

import {useDebouncedValue} from './useDebouncedValue';

/** Value returned by {@link useListSearch}. */
export interface ListSearch {
  /** Current text of the input (updates on every keystroke). */
  query: string;
  setQuery: (_value: string) => void;
  /**
   * Debounced and trimmed term to send to the server. Empty means "no
   * filter", also while the text is shorter than `minLength`.
   */
  term: string;
  /** Whether the search bar is visible. */
  open: boolean;
  /** Shows / hides the search bar. Closing also clears the text. */
  toggle: () => void;
}

/**
 * Search state for a list tab: visibility, raw text and debounced term.
 *
 * Wire `toggle` to the container's search button, `query` / `setQuery` to the
 * `SearchBar`, and `term` to the fetcher.
 *
 * @param minLength Shorter terms are ignored. Trigram indexes only help from
 *     3 characters, so very short terms just scan the table.
 * @param initialOpen Starts with the search bar (and the filters next to it)
 *     visible, e.g. when the tab opens with a filter already set.
 */
export function useListSearch(
  delayMs = 300,
  minLength = 2,
  initialOpen = false,
): ListSearch {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(initialOpen);
  const debounced = useDebouncedValue(query.trim(), delayMs);

  const toggle = useCallback(() => {
    setOpen(wasOpen => !wasOpen);
    // Opening: the text is already empty. Closing: drop the hidden filter.
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    term: debounced.length >= minLength ? debounced : '',
    open,
    toggle,
  };
}
