/**
 * How the app can reach the device location.
 *
 * - `granted`: the location permission is granted, the app may read a
 *   position.
 * - `denied`: the user refused the permission.
 * - `prompt`: the permission was never asked for, it can still be requested.
 * - `unavailable`: the device or browser cannot provide a location at all
 *   (no geolocation support, or a webview without a location provider).
 */
export type LocationAccess = 'granted' | 'denied' | 'prompt' | 'unavailable';

/** `GeolocationPositionError.PERMISSION_DENIED`. */
const PERMISSION_DENIED = 1;

/** Time the user has to answer the permission prompt. */
const PERMISSION_TIMEOUT_MS = 30000;

function hasGeolocation(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Reads the permission state without asking anything.
 *
 * Returns `null` when the browser does not know the `geolocation` permission
 * (Firefox and Safari), in which case only a position request can tell.
 */
async function readPermissionState(): Promise<PermissionState | null> {
  if (!hasGeolocation() || !navigator.permissions?.query) return null;

  try {
    const status = await navigator.permissions.query({name: 'geolocation'});
    return status.state;
  } catch {
    // The Permissions API does not know this permission name.
    return null;
  }
}

/**
 * The current access to the location, without triggering the permission
 * prompt.
 */
export async function getLocationAccess(): Promise<LocationAccess> {
  if (!hasGeolocation()) return 'unavailable';

  const state = await readPermissionState();
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';

  return 'prompt';
}

/**
 * Asks for the location permission and reports the result.
 *
 * The position request is what triggers the browser or system prompt, so it
 * has to be made from a user gesture.
 */
export async function requestLocationAccess(): Promise<LocationAccess> {
  if (!hasGeolocation()) return 'unavailable';

  const access = await new Promise<LocationAccess>(resolve => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      error => {
        resolve(error.code === PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      {
        enableHighAccuracy: false,
        timeout: PERMISSION_TIMEOUT_MS,
        maximumAge: 0,
      },
    );
  });

  if (access === 'granted') return 'granted';

  // A position can be unavailable while the permission itself is fine (no
  // GPS fix, or a webview without a location provider): ask who is right.
  const state = await readPermissionState();
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';

  return access;
}
