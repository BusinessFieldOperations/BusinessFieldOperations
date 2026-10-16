import {snackbar} from 'mdui/functions/snackbar.js';

import type {RefObject} from 'preact';
import {useRef, useState} from 'preact/hooks';

import {getCurrentFix, type GeoFix} from '@/lib/geolocation';
import {enqueue, type OfflineKind} from '@/lib/offline';
import type {ReportProblem} from '@/lib/reportPayloads';

const PROBLEM_MESSAGES: Record<ReportProblem, string> = {
  missing_salesman: 'Enter the salesman name.',
  missing_zone: 'Enter the zone.',
  missing_client: 'Select a client.',
  missing_state:
    'This establishment is not fully synced yet. Connect and try again.',
  missing_products: 'Add at least one product.',
  missing_counts: 'Enter the counts of every product.',
  invalid_counts:
    'Check the counts: whole numbers only, and the final inventory cannot ' +
    'exceed the initial plus the restocked units.',
};

/** Options of {@link useReportSubmit}. */
export interface UseReportSubmitOptions {
  kind: OfflineKind;
  ownerId: string | undefined;
  /** Id of the draft being sent: it becomes the outbox item id. */
  draftId: string;
  /** Throws the draft away and starts a new one (`useDraft`'s `reset`). */
  reset: () => Promise<void>;
  /** Why the form cannot be sent yet, or `null` if it can. */
  check: () => ReportProblem | null;
  /** What to send, given the position read at Send (`null` if unavailable). */
  build: (_location: GeoFix | null) => Record<string, unknown>;
  /** The report is safely stored on this device: close the form. */
  onQueued: () => void;
}

/** Value returned by {@link useReportSubmit}. */
export interface ReportSubmit {
  /** Put it on the `<form>`: its native validation runs before sending. */
  formRef: RefObject<HTMLFormElement>;
  sending: boolean;
  /** Message to show in the form (validation or storage problem). */
  error: string | null;
  send: () => Promise<void>;
}

/**
 * The Send button of a report form.
 *
 * It validates, reads the device position, and then `enqueue` stamps
 * `captured_at` (the first valid Send freezes it), stores the report in the
 * outbox and deletes the draft in ONE transaction. The position goes inside
 * the payload, so it is fixed from that moment, even while the report waits
 * for a connection. Nothing waits for the network: the outbox sender
 * delivers it.
 */
export function useReportSubmit({
  kind,
  ownerId,
  draftId,
  reset,
  check,
  build,
  onQueued,
}: UseReportSubmitOptions): ReportSubmit {
  const formRef = useRef<HTMLFormElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (sending || !ownerId) {
      return;
    }

    setError(null);

    // Native validation (required, min, max...) shows its own hints.
    if (formRef.current && !formRef.current.reportValidity()) {
      return;
    }

    const problem = check();

    if (problem) {
      setError(PROBLEM_MESSAGES[problem]);
      return;
    }

    setSending(true);

    try {
      // Never fails: without a position the report simply has none.
      const location = await getCurrentFix();

      await enqueue({kind, ownerId, draftId, payload: build(location)});
      // The draft id is an outbox id now: never reuse it.
      await reset();
      onQueued();
      snackbar({
        message: 'Report saved on this device. It will be sent automatically.',
        placement: 'top',
      });
    } catch (cause) {
      console.error('Failed to queue the report', cause);
      setError('The report could not be saved on this device. Try again.');
    } finally {
      setSending(false);
    }
  };

  return {formRef, sending, error, send};
}
