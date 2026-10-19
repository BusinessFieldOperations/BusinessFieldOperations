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
 */
export function openDashboardTab(tab: string): void {
  const target = `${DASHBOARD_PATH}/${tab}`;

  if (window.location.pathname !== target) {
    window.history.pushState(null, '', target);
  }
}
