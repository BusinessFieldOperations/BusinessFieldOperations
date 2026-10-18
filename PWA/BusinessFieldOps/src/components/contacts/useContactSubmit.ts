import {snackbar} from 'mdui/functions/snackbar.js';

import type {RefObject} from 'preact';
import {useRef, useState} from 'preact/hooks';

import {
  ContactNeedsConnectionError,
  ContactRecipientError,
} from '@/lib/contactActions';
import type {ContactProblem} from '@/lib/contactPayloads';
import {ContactSendingError} from '@/lib/offline';
import {m} from '@/paraglide/messages.js';

/** Functions, so the text follows the language at the moment it is shown. */
const PROBLEM_MESSAGES: Record<ContactProblem, () => string> = {
  missing_first_name: () => m.contact_problem_first_name(),
  missing_last_name: () => m.contact_problem_last_name(),
  invalid_email: () => m.contact_problem_email(),
  missing_extra_key: () => m.contact_problem_extra_key(),
  duplicate_extra_key: () => m.contact_problem_extra_duplicate(),
};

function describeFailure(cause: unknown): string {
  if (cause instanceof ContactSendingError) {
    return m.contact_error_sending();
  }

  if (cause instanceof ContactNeedsConnectionError) {
    return m.contact_error_connection();
  }

  if (cause instanceof ContactRecipientError) {
    return m.contact_error_recipient();
  }

  return m.contact_error_save();
}

/** Options of {@link useContactSubmit}. */
export interface UseContactSubmitOptions<T> {
  /** Profile id of the signed-in user. Nothing happens without it. */
  ownerId: string | undefined;
  /** Why the form cannot be saved yet, or `null` if it can. */
  check: () => ContactProblem | null;
  /** Stores or sends the contact. It throws if that is not possible. */
  run: () => Promise<T>;
  /** Text of the confirmation shown once it is done (gets what `run` returned). */
  doneMessage: (_result: T) => string;
  /** Done: close the form. */
  onDone: () => void;
}

/** Value returned by {@link useContactSubmit}. */
export interface ContactSubmit {
  /** Put it on the `<form>`: its native validation runs before saving. */
  formRef: RefObject<HTMLFormElement>;
  sending: boolean;
  /** Message to show in the form (validation or saving problem). */
  error: string | null;
  send: () => Promise<void>;
}

/**
 * The Send / Save button of a contact form: native validation, our own
 * checks, then `run`. A failure stays in the form as `error`.
 */
export function useContactSubmit<T = void>({
  ownerId,
  check,
  run,
  doneMessage,
  onDone,
}: UseContactSubmitOptions<T>): ContactSubmit {
  const formRef = useRef<HTMLFormElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (sending || !ownerId) {
      return;
    }

    setError(null);

    // Native validation (required, email...) shows its own hints.
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
      const result = await run();
      onDone();
      snackbar({message: doneMessage(result), placement: 'top'});
    } catch (cause) {
      console.error('Failed to save the contact', cause);
      setError(describeFailure(cause));
    } finally {
      setSending(false);
    }
  };

  return {formRef, sending, error, send};
}
