/**
 * Opens a link outside the app: in the system browser inside Tauri (a plain
 * `<a target="_blank">` does nothing there) and in a new tab in the PWA.
 */
export async function openExternal(url: string): Promise<void> {
  if ('__TAURI_INTERNALS__' in window) {
    const {openUrl} = await import('@tauri-apps/plugin-opener');

    await openUrl(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
