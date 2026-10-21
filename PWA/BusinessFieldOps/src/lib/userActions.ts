import {FunctionsFetchError, FunctionsHttpError} from '@supabase/supabase-js';

import {db} from '@/lib/offline/db';
import type {UserRole} from '@/lib/profiles';
import {supabase} from '@/lib/supabase';

/** Same value as `minimum_password_length` in the Supabase config. */
export const MIN_PASSWORD_LENGTH = 6;

/** Codes the `admin-users` Edge Function answers with (`{"error": code}`). */
const SERVER_CODES = [
  'not_authenticated',
  'not_allowed',
  'invalid_request',
  'invalid_email',
  'invalid_role',
  'missing_name',
  'weak_password',
  'same_password',
  'user_not_found',
  'ci_taken',
  'email_taken',
  'server_error',
] as const;

/**
 * Why a user action failed. The forms turn each code into a message:
 * - `needs_connection`: these actions go straight to the server (no outbox).
 * - `own_profile_locked`: an administrator tried to change their own role or
 *   active flag.
 * - `unknown`: anything else; the cause is logged by the caller.
 */
export type UserErrorCode =
  | (typeof SERVER_CODES)[number]
  | 'needs_connection'
  | 'own_profile_locked'
  | 'unknown';

export class UserActionError extends Error {
  readonly code: UserErrorCode;

  constructor(code: UserErrorCode) {
    super(code);
    this.name = 'UserActionError';
    this.code = code;
  }
}

const isServerCode = (value: unknown): value is (typeof SERVER_CODES)[number] =>
  typeof value === 'string' &&
  (SERVER_CODES as readonly string[]).includes(value);

function assertOnline(): void {
  if (!navigator.onLine) {
    throw new UserActionError('needs_connection');
  }
}

// -------------------------------------------------------- Edge Function

/**
 * Calls `admin-users` (create a user, set a password: the actions that need
 * the service_role key). Resolves with the function's answer; failures are
 * {@link UserActionError}s.
 */
async function callAdminFunction(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  assertOnline();

  const {data, error} = await supabase.functions.invoke<
    Record<string, unknown>
  >('admin-users', {body});

  if (!error) {
    return data ?? {};
  }

  if (error instanceof FunctionsHttpError) {
    let code: unknown;

    try {
      code = ((await error.context.json()) as {error?: unknown}).error;
    } catch {
      code = undefined;
    }

    throw new UserActionError(isServerCode(code) ? code : 'unknown');
  }

  // No answer from the function at all: a lost connection, or the function is
  // not deployed (relay error).
  throw new UserActionError(
    error instanceof FunctionsFetchError ? 'needs_connection' : 'unknown',
  );
}

// -------------------------------------------------------------- creating

/** Input of {@link createUser}. */
export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  /** A blank ci must be `null`. */
  ci: string | null;
}

/**
 * Administrators only (the function checks it): creates the account and its
 * profile. Needs a connection. Resolves with the new user's id.
 *
 * The local copy gets the profile right away, so the list shows it without
 * waiting for the next sync.
 */
export async function createUser(input: CreateUserInput): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const ci = input.ci?.trim() || null;

  const result = await callAdminFunction({
    action: 'create',
    email,
    password: input.password,
    role: input.role,
    first_name: firstName,
    last_name: lastName,
    ci,
  });

  if (typeof result.id !== 'string') {
    throw new UserActionError('unknown');
  }

  try {
    await db.reference('profiles').put({
      id: result.id,
      first_name: firstName,
      last_name: lastName,
      email,
      ci,
      role: input.role,
      is_active: true,
    });
  } catch (cause) {
    console.warn('Could not store the new user locally', cause);
  }

  return result.id;
}

// --------------------------------------------------------------- editing

/** The profile fields an administrator can change. */
export type UserProfileFields = Partial<{
  first_name: string;
  last_name: string;
  /** A blank ci must be `null`. */
  ci: string | null;
  role: UserRole;
  is_active: boolean;
}>;

/**
 * Turns a failed request into the right error. supabase-js reports a lost
 * connection with an empty code; everything else is the server's answer.
 */
function profileFailure(error: {
  code?: string | null;
  message: string;
}): unknown {
  if (!error.code) {
    return new UserActionError('needs_connection');
  }

  // The only unique column an update can collide on is ci.
  if (error.code === '23505') {
    return new UserActionError('ci_taken');
  }

  if (error.code === 'P0001' && error.message === 'own_profile_locked') {
    return new UserActionError('own_profile_locked');
  }

  if (error.code === '42501') {
    return new UserActionError('not_allowed');
  }

  return error;
}

/**
 * Edits a profile (administrators only, RLS decides). Needs a connection.
 * Send only what changed: when editing yourself leave `role` and `is_active`
 * out, the database refuses to change them.
 *
 * On success the local copy is replaced with the server's row, so lists and
 * dialogs change at once.
 */
export async function updateUserProfile(
  userId: string,
  fields: UserProfileFields,
): Promise<void> {
  assertOnline();

  const {data, error} = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select();

  if (error) {
    throw profileFailure(error);
  }

  // RLS hides rows it does not allow instead of failing.
  if (!data || data.length === 0) {
    throw new UserActionError('user_not_found');
  }

  try {
    await db.reference('profiles').put(data[0]);
  } catch (cause) {
    console.warn('Could not store the edited user locally', cause);
  }
}

/**
 * Sets a new password for any user, yourself included. Needs a connection.
 * The password is never stored on this device.
 */
export async function setUserPassword(
  userId: string,
  password: string,
): Promise<void> {
  await callAdminFunction({
    action: 'set_password',
    user_id: userId,
    password,
  });
}
