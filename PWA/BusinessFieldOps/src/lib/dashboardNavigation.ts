/** Path every dashboard tab lives under (see `App.tsx`). */
const DASHBOARD_PATH = '/dashboard';

/**
 * Opens a dashboard tab from anywhere inside it.
 *
 * `navigate()` of wouter is relative to the nested route it is called from:
 * inside Home it would go to `/dashboard/home/reports`. This pushes the
 * absolute URL instead; wouter patches `history.pushState`, so the routes
 * update, like they do for `setDialogParams`. Dialog parameters (`?task=`...)
 * are dropped on purpose.
 *
 * `params` are query parameters for the tab that opens, e.g. the filter a list
 * starts with (`{user: id}`, read by `useUrlFilter`). A tab reads them when it
 * mounts, so pass them when opening ANOTHER tab: one that is already showing
 * keeps the filters it has.
 */
export function openDashboardTab(
  tab: string,
  params?: Readonly<Record<string, string>>,
): void {
  const url = new URL(`${DASHBOARD_PATH}/${tab}`, window.location.origin);

  // Already there and nothing to hand over: leave the history alone.
  if (!params && window.location.pathname === url.pathname) {
    return;
  }

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  window.history.pushState(null, '', `${url.pathname}${url.search}`);
}
