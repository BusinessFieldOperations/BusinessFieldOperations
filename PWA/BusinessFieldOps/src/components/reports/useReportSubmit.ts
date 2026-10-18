import {snackbar} from 'mdui/functions/snackbar.js';

import type {RefObject} from 'preact';
import {useRef, useState} from 'preact/hooks';

import {getCurrentFix, type GeoFix} from '@/lib/geolocation';
import {enqueue, type OfflineKind} from '@/lib/offline';
import type {ReportProblem} from '@/lib/reportPayloads';
import {m} from '@/paraglide/messages.js';

const PROBLEM_MESSAGES: Record<ReportProblem, () => string> = {
  missing_salesman: () => m.report_problem_salesman(),
  missing_zone: () => m.report_problem_zone(),
  missing_client: () => m.report_problem_client(),
  missing_state: () => m.report_problem_state(),
  missing_products: () => m.report_problem_products(),
  missing_counts: () => m.report_problem_counts(),
  invalid_counts: () => m.report_problem_invalid_counts(),
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
      setError(PROBLEM_MESSAGES[problem]());
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
        message: m.report_saved_device(),
        placement: 'top',
      });
    } catch (cause) {
      console.error('Failed to queue the report', cause);
      setError(m.report_error_save());
    } finally {
      setSending(false);
    }
  };

  return {formRef, sending, error, send};
}
