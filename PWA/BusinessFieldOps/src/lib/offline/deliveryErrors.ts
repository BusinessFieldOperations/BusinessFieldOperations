import {m} from '@/paraglide/messages.js';

import type {OfflineKind, OutboxError} from './types';

/**
 * Whether the server refused a record for good, so sending it again cannot
 * work. Mirrors the lists in the headers of `04_reports_functions.sql` and
 * `05_contacts_functions.sql`: `P0001` (task_unavailable, unknown_salesfloor,
 * contact_not_found, contact_not_editable...), `22xxx` and `23xxx` (invalid or
 * conflicting data) and `42501` (not allowed).
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

/** Messages the `submit_*` / `update_contact` functions raise on purpose. */
const KNOWN_MESSAGES: Record<string, () => string> = {
  task_unavailable: () => m.delivery_task_unavailable(),
  unknown_salesfloor: () => m.delivery_unknown_salesfloor(),
  contact_not_found: () => m.delivery_contact_not_found(),
  contact_not_editable: () => m.delivery_contact_not_editable(),
};

/** Whether the record is a contact (the message names the right thing). */
const isContact = (kind: OfflineKind | undefined) =>
  kind === 'contact' || kind === 'contact_update';

/**
 * Why a record was refused, in words for the user. Pass the `kind` of the
 * outbox item so the message names the right thing (report or contact).
 */
export function describeDeliveryError(
  error: OutboxError | null,
  kind?: OfflineKind,
): string {
  const known = error ? KNOWN_MESSAGES[error.message] : undefined;

  if (known) {
    return known();
  }

  const contact = isContact(kind);

  if (error?.code === '42501') {
    return contact
      ? m.delivery_contact_not_allowed()
      : m.delivery_report_not_allowed();
  }

  if (error?.code?.startsWith('22') || error?.code?.startsWith('23')) {
    return contact ? m.delivery_contact_invalid() : m.delivery_report_invalid();
  }

  return contact ? m.delivery_contact_refused() : m.delivery_report_refused();
}
