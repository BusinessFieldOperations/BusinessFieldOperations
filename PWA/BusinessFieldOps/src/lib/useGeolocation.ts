import {useCallback, useEffect, useRef, useState} from 'preact/hooks';

/** A position reading, in the units the report tables use. */
export interface GeoFix {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in meters. */
  accuracyM: number;
}

export type GeoStatus = 'idle' | 'locating' | 'ready' | 'error';

/** Value returned by {@link useGeolocation}. */
export interface GeoState {
  fix: GeoFix | null;
  status: GeoStatus;
  /** Asks for a new reading (the previous fix stays until it arrives). */
  refresh: () => void;
}

/**
 * Reads the device position once `enabled` is true, and again on `refresh`.
 *
 * A failure (permission denied, no signal, timeout) only sets `status` to
 * `error`: callers must not block anything on it.
 */
export function useGeolocation(enabled: boolean): GeoState {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const requestRef = useRef(0);

  const refresh = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }

    // A newer request (or unmounting) makes older answers irrelevant.
    const requestId = ++requestRef.current;
    setStatus('locating');

    navigator.geolocation.getCurrentPosition(
      position => {
        if (requestId !== requestRef.current) {
          return;
        }

        setFix({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        });
        setStatus('ready');
      },
      () => {
        if (requestId === requestRef.current) {
          setStatus('error');
        }
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 30000},
    );
  }, []);

  useEffect(() => {
    if (enabled) {
      refresh();
    }

    return () => {
      requestRef.current += 1;
    };
  }, [enabled, refresh]);

  return {fix, status, refresh};
}
