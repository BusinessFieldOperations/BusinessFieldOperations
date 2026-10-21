import './LocationAccess.css';

import 'mdui/components/button.js';
import 'mdui/components/circular-progress.js';
import 'mdui/components/icon.js';

import type {LocationAccess} from '@/lib/locationPermission';
import {m} from '@/paraglide/messages.js';

/** Props of {@link LocationAccessPanel}. */
export interface LocationAccessPanelProps {
  /** Current access to the device location. */
  access: LocationAccess;
  /** True while the permission is being asked for. */
  busy: boolean;
  /** Asks the browser for the location permission. */
  onRequest: () => void;
  /**
   * Continues without the location permission. Only offered when the
   * permission was refused: the terms say that the location can be disabled
   * and that it only limits some features.
   */
  onSkip: () => void;
}

/**
 * The location step of the splash: shows whether the app may read the device
 * position and lets the user ask for the permission.
 */
export function LocationAccessPanel({
  access,
  busy,
  onRequest,
  onSkip,
}: LocationAccessPanelProps) {
  const granted = access === 'granted';
  const denied = access === 'denied';
  const unavailable = access === 'unavailable';

  return (
    <section class="location-access">
      <h3 class="location-access__title">{m.splash_location_title()}</h3>

      <p class="location-access__status">
        {busy ? (
          <>
            <mdui-circular-progress class="location-access__spinner" />
            {m.splash_location_checking()}
          </>
        ) : granted ? (
          <>
            <mdui-icon name="check_circle" />
            {m.splash_location_granted()}
          </>
        ) : denied ? (
          <>
            <mdui-icon name="location_off" />
            {m.splash_location_denied()}
          </>
        ) : unavailable ? (
          <>
            <mdui-icon name="location_disabled" />
            {m.splash_location_unavailable()}
          </>
        ) : (
          <>
            <mdui-icon name="location_on" />
            {m.splash_location_needed()}
          </>
        )}
      </p>

      {granted || busy || unavailable ? null : (
        <div class="location-access__actions">
          <mdui-button variant="tonal" icon="my_location" onClick={onRequest}>
            {denied ? m.splash_location_retry() : m.splash_location_request()}
          </mdui-button>

          {denied ? (
            <mdui-button variant="text" onClick={onSkip}>
              {m.splash_location_skip()}
            </mdui-button>
          ) : null}
        </div>
      )}
    </section>
  );
}
