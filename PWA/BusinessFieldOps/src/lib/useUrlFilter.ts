import {useEffect, useState} from 'preact/hooks';

/** Removes a query parameter without adding a history entry. */
function removeUrlParam(key: string): void {
  const url = new URL(window.location.href);

  if (!url.searchParams.has(key)) {
    return;
  }

  url.searchParams.delete(key);
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
}

/**
 * A filter handed over by the URL (`/dashboard/tasks?user=<id>`), as the
 * starting value of a list's own filter state. `''` when the URL has none.
 *
 * It is read once, when the tab mounts, and then removed from the URL: from
 * there the tab owns the filter, so clearing it sticks and a reload does not
 * bring it back.
 *
 * @example
 * const [assigneeId, setAssigneeId] = useState(useUrlFilter('user'));
 */
export function useUrlFilter(key: string): string {
  const [value] = useState(
    () => new URLSearchParams(window.location.search).get(key) ?? '',
  );

  useEffect(() => removeUrlParam(key), [key]);

  return value;
}
