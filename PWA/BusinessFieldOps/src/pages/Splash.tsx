import './Splash.css';

import 'mdui/components/button.js';
import 'mdui/components/checkbox.js';
import 'mdui/components/layout.js';
import 'mdui/components/layout-main.js';

import {useCallback, useEffect, useRef, useState} from 'preact/hooks';

import MainTitle from '@/components/MainTitle';
import {LocationAccessPanel, TermsDocument} from '@/components/splash';
import {config, optionalConfig} from '@/config';
import {
  fillTermsPlaceholders,
  formatTermsDate,
  getTermsDocument,
} from '@/content/terms';
import {acceptTerms} from '@/lib/firstRun';
import {
  getLocationAccess,
  requestLocationAccess,
  type LocationAccess,
} from '@/lib/locationPermission';
import {m} from '@/paraglide/messages.js';

/** Props of {@link Splash}. */
export interface SplashProps {
  /** Called once the terms were accepted and the app may be used. */
  onAccepted: () => void;
}

/**
 * The first run screen: the Terms of Use and the location permission.
 *
 * The terms have to be scrolled to the end before they can be accepted, and
 * the location permission has to be granted before the app continues.
 */
export default function Splash({onAccepted}: SplashProps) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [access, setAccess] = useState<LocationAccess>('prompt');
  const [checking, setChecking] = useState(true);
  const [locationSkipped, setLocationSkipped] = useState(false);

  const termsRef = useRef<HTMLDivElement | null>(null);

  const terms = fillTermsPlaceholders(getTermsDocument(), config.name);
  const lastUpdated = formatTermsDate(config.tosDate);

  // The current permission, read without asking anything.
  useEffect(() => {
    let active = true;

    void getLocationAccess().then(state => {
      if (active) {
        setAccess(state);
        setChecking(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // The terms can only be accepted once they were read to the end.
  const handleScroll = useCallback(() => {
    const element = termsRef.current;
    if (!element) return;

    // A box that does not scroll is already read to the end.
    const atEnd =
      element.scrollHeight <= element.clientHeight ||
      element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    if (atEnd) setScrolledToEnd(true);
  }, []);

  // The terms may be shorter than the box: then they were read at once.
  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  const handleRequestLocation = useCallback(async () => {
    setChecking(true);
    setAccess(await requestLocationAccess());
    setChecking(false);
  }, []);

  const handleAccept = useCallback(() => {
    acceptTerms();
    onAccepted();
  }, [onAccepted]);

  // A device that cannot provide a location is not blocked: the terms say
  // that the location can be disabled and that it only limits some features.
  const locationReady =
    access === 'granted' || access === 'unavailable' || locationSkipped;
  const canContinue = accepted && scrolledToEnd && locationReady;

  return (
    <mdui-layout full-height class="splash">
      <mdui-layout-main class="splash__main">
        <div class="splash__header">
          <MainTitle />
          <p class="splash__updated">
            {terms.lastUpdatedLabel}: {lastUpdated}
          </p>
        </div>

        <div
          class="splash__terms"
          ref={termsRef}
          onScroll={handleScroll}
          role="region"
          aria-label={terms.title}
          tabIndex={0}
        >
          <TermsDocument
            document={terms}
            supportEmail={optionalConfig.supportEmail}
          />
        </div>

        <div class="splash__footer">
          <label class="splash__accept">
            <mdui-checkbox
              checked={accepted}
              disabled={!scrolledToEnd}
              onChange={e =>
                setAccepted((e.currentTarget as HTMLInputElement).checked)
              }
            />
            <span class="splash__accept-label">
              {scrolledToEnd
                ? m.splash_accept()
                : m.splash_accept_after_reading()}
            </span>
          </label>

          <LocationAccessPanel
            access={access}
            busy={checking}
            onRequest={handleRequestLocation}
            onSkip={() => setLocationSkipped(true)}
          />

          <mdui-button
            variant="filled"
            full-width
            disabled={!canContinue}
            onClick={handleAccept}
          >
            {m.splash_continue()}
          </mdui-button>
        </div>
      </mdui-layout-main>
    </mdui-layout>
  );
}
