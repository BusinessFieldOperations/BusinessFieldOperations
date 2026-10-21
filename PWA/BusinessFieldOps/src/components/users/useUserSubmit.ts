import {snackbar} from 'mdui/functions/snackbar.js';

import type {RefObject} from 'preact';
import {useRef, useState} from 'preact/hooks';

import {
  MIN_PASSWORD_LENGTH,
  UserActionError,
  type UserErrorCode,
} from '@/lib/userActions';
import type {UserProblem} from '@/lib/userForm';
import {m} from '@/paraglide/messages.js';

/** Functions, so the text follows the language at the moment it is shown. */
const PROBLEM_MESSAGES: Record<UserProblem, () => string> = {
  missing_name: () => m.user_problem_name(),
  invalid_email: () => m.user_problem_email(),
  missing_role: () => m.user_problem_role(),
  weak_password: () => m.user_problem_password({min: MIN_PASSWORD_LENGTH}),
  password_mismatch: () => m.user_problem_password_mismatch(),
};

/** One message per code: a new code that is not listed fails to compile. */
const ERROR_MESSAGES: Record<UserErrorCode, () => string> = {
  needs_connection: () => m.user_error_connection(),
  ci_taken: () => m.user_error_ci_taken(),
  email_taken: () => m.user_error_email_taken(),
  invalid_email: () => m.user_problem_email(),
  invalid_role: () => m.user_problem_role(),
  missing_name: () => m.user_problem_name(),
  weak_password: () => m.user_problem_password({min: MIN_PASSWORD_LENGTH}),
  same_password: () => m.user_error_same_password(),
  own_profile_locked: () => m.user_self_locked(),
  user_not_found: () => m.user_error_not_found(),
  not_authenticated: () => m.user_error_not_allowed(),
  not_allowed: () => m.user_error_not_allowed(),
  invalid_request: () => m.user_error_save(),
  server_error: () => m.user_error_save(),
  unknown: () => m.user_error_save(),
};

function describeFailure(cause: unknown): string {
  return cause instanceof UserActionError
    ? ERROR_MESSAGES[cause.code]()
    : m.user_error_save();
}

/** Options of {@link useUserSubmit}. */
export interface UseUserSubmitOptions {
  /** Why the form cannot be saved yet, or `null` if it can. */
  check: () => UserProblem | null;
  /** Creates or changes the user. It throws if that is not possible. */
  run: () => Promise<void>;
  /** Text of the confirmation shown once it is done. */
  doneMessage: () => string;
  /** Done: close the form. */
  onDone: () => void;
}

/** Value returned by {@link useUserSubmit}. */
export interface UserSubmit {
  /** Put it on the `<form>`: its native validation runs before saving. */
  formRef: RefObject<HTMLFormElement>;
  sending: boolean;
  /** Message to show in the form (validation or saving problem). */
  error: string | null;
  send: () => Promise<void>;
}

/**
 * The Save button of a user form: native validation, our own checks, then
 * `run`. A failure stays in the form as `error`.
 */
export function useUserSubmit({
  check,
  run,
  doneMessage,
  onDone,
}: UseUserSubmitOptions): UserSubmit {
  const formRef = useRef<HTMLFormElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (sending) {
      return;
    }

    setError(null);

    // Native validation (required, email, minlength...) shows its own hints.
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
      await run();
      onDone();
      snackbar({message: doneMessage(), placement: 'top'});
    } catch (cause) {
      console.error('Failed to save the user', cause);
      setError(describeFailure(cause));
    } finally {
      setSending(false);
    }
  };

  return {formRef, sending, error, send};
}
