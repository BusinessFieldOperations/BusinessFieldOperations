/** A position reading, in the units the report tables use. */
export interface GeoFix {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in meters. */
  accuracyM: number;
}

const options = {enableHighAccuracy: true, timeout: 10000};

/**
 * Reads the device position right now. Resolves `null` instead of failing
 * (permission denied, no signal, timeout): a report is sent without a
 * position rather than not sent.
 */
export function getCurrentFix(): Promise<GeoFix | null> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }

    // Safety net: some WebViews never call back if the permission prompt is
    // not handled, and Send must not wait forever.
    const giveUp = setTimeout(() => resolve(null), options.timeout + 5000);

    navigator.geolocation.getCurrentPosition(
      position => {
        clearTimeout(giveUp);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        });
      },
      () => {
        clearTimeout(giveUp);
        resolve(null);
      },
      // maximumAge 0: never an old reading, it is the position at Send.
      {...options, maximumAge: 0},
    );
  });
}

/**
 * Starts a reading and throws it away. It asks for the permission and wakes
 * the GPS early, so the real reading at Send is quick and the permission
 * prompt does not appear in the middle of sending.
 */
export function warmUpGeolocation(): void {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      () => undefined,
      () => undefined,
      {...options, maximumAge: 30000},
    );
  }
}
