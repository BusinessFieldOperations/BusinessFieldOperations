import {config} from '@/config';

/**
 * Where the acceptance of the Terms of Use is remembered.
 *
 * The record is device local: the app can be used offline and before signing
 * in, so a server side record would not be available when the splash shows.
 */
const STORAGE_KEY = 'bfo.tos.accepted';

/** What is stored once the terms are accepted. */
export interface TermsAcceptance {
  /**
   * Version of the terms that were accepted: the value of
   * `VITE_BUSINESS_TOS_DATE`. When the business publishes new terms, this
   * value changes and the terms are shown again.
   */
  version: string;
  /** ISO timestamp of the acceptance. */
  acceptedAt: string;
}

function readAcceptance(): TermsAcceptance | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<TermsAcceptance>;
    if (typeof parsed?.version !== 'string') return null;

    return {
      version: parsed.version,
      acceptedAt:
        typeof parsed.acceptedAt === 'string'
          ? parsed.acceptedAt
          : new Date().toISOString(),
    };
  } catch {
    // Corrupted or unavailable storage: treat it as not accepted.
    return null;
  }
}

/**
 * True when the terms of the current version were already accepted on this
 * device.
 */
export function hasAcceptedTerms(): boolean {
  const acceptance = readAcceptance();
  return acceptance?.version === config.tosDate;
}

/** Remembers that the terms were accepted on this device. */
export function acceptTerms(): void {
  const acceptance: TermsAcceptance = {
    version: config.tosDate,
    acceptedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(acceptance));
  } catch {
    // Storage unavailable (private mode, quota): the app still works, the
    // terms are just shown again on the next start.
  }
}
