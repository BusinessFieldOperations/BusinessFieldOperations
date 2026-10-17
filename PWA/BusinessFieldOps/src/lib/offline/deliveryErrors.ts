import type {OutboxError} from './types';

/**
 * Whether the server refused a record for good, so sending it again cannot
 * work. Mirrors the list in the header of `04_reports_functions.sql`:
 * `P0001` (task_unavailable, unknown_salesfloor), `22xxx` and `23xxx`
 * (invalid or conflicting data) and `42501` (not allowed).
 *
 * Anything else is temporary: no connection (empty code), 5xx, an expired
 * session...
 */
export function isFinalError(code: string | null | undefined): boolean {
  if (!code) {
    return false;
  }

  return (
    code === 'P0001' ||
    code === '42501' ||
    code.startsWith('22') ||
    code.startsWith('23')
  );
}

/** Messages the `submit_*` functions raise on purpose. */
const KNOWN_MESSAGES: Record<string, string> = {
  task_unavailable: 'The task was closed or reassigned.',
  unknown_salesfloor: 'The inventory points to a salesfloor that is missing.',
};

/** Why a record was refused, in words for the user. */
export function describeDeliveryError(error: OutboxError | null): string {
  if (error && KNOWN_MESSAGES[error.message]) {
    return KNOWN_MESSAGES[error.message];
  }

  if (error?.code === '42501') {
    return 'You are not allowed to send this report.';
  }

  if (error?.code?.startsWith('22') || error?.code?.startsWith('23')) {
    return 'The report has invalid data.';
  }

  return 'The server refused this report.';
}
