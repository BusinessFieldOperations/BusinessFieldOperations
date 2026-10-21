// Administrator-only actions that need the service_role key: creating a user
// and setting a password. Everything else about a profile (names, ci, role,
// is_active) is edited straight in `public.profiles`, where RLS already limits
// writes to administrators.
//
// `verify_jwt` is off in config.toml on purpose: the caller is checked here,
// with their session token, so it works with any kind of API key.
//
// Request (POST, JSON):
//   {"action": "create", "email": "...", "password": "...", "role": "merchant",
//    "first_name": "...", "last_name": "...", "ci": "..."}  ->  {"id": "<uuid>"}
//   {"action": "set_password", "user_id": "<uuid>", "password": "..."}
//                                                           ->  {"ok": true}
//
// Errors are {"error": "<code>"} with an HTTP status:
//   401 not_authenticated
//   403 not_allowed
//   400 invalid_request, invalid_email, invalid_role, missing_name,
//       weak_password, same_password
//   404 user_not_found
//   409 ci_taken, email_taken
//   500 server_error
//
// Deploy: `supabase functions deploy admin-users` (from the DB folder).

import {createClient} from 'npm:@supabase/supabase-js@2';

const ROLES = ['merchant', 'promoter', 'administrator'] as const;
type Role = (typeof ROLES)[number];

/** Same value as `minimum_password_length` in config.toml. */
const MIN_PASSWORD_LENGTH = 6;
/** Same rule as the contacts table and the login form. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {auth: {persistSession: false, autoRefreshToken: false}},
);

/** An error the caller should see as `{"error": code}`. */
class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {...CORS_HEADERS, 'Content-Type': 'application/json'},
  });

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** Passwords are used exactly as typed: no trimming. */
function readPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, 'weak_password');
  }

  return value;
}

/** Only an active administrator may call this function. */
async function requireAdministrator(req: Request): Promise<void> {
  const token = (req.headers.get('Authorization') ?? '').replace(
    /^Bearer\s+/i,
    '',
  );

  if (!token) {
    throw new HttpError(401, 'not_authenticated');
  }

  const {data, error} = await admin.auth.getUser(token);

  if (error || !data.user) {
    throw new HttpError(401, 'not_authenticated');
  }

  const {data: profile, error: profileError} = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile?.is_active || profile.role !== 'administrator') {
    throw new HttpError(403, 'not_allowed');
  }
}

async function ciExists(ci: string): Promise<boolean> {
  const {data, error} = await admin
    .from('profiles')
    .select('id')
    .eq('ci', ci)
    .limit(1);

  if (error) {
    throw error;
  }

  return data.length > 0;
}

async function createUser(body: Record<string, unknown>) {
  const email = text(body.email).toLowerCase();
  const password = readPassword(body.password);
  const firstName = text(body.first_name);
  const lastName = text(body.last_name);
  const ci = text(body.ci) || null;
  const role = body.role;

  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'invalid_email');
  }

  if (!ROLES.includes(role as Role)) {
    throw new HttpError(400, 'invalid_role');
  }

  if (firstName === '' || lastName === '') {
    throw new HttpError(400, 'missing_name');
  }

  if (ci && (await ciExists(ci))) {
    throw new HttpError(409, 'ci_taken');
  }

  // The role goes in app_metadata (only service_role can set it); the trigger
  // handle_new_user builds the profile from it and from the names.
  const {data, error} = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {role},
    user_metadata: {first_name: firstName, last_name: lastName},
  });

  if (error || !data.user) {
    if (error?.code === 'email_exists') {
      throw new HttpError(409, 'email_taken');
    }

    if (error?.code === 'weak_password') {
      throw new HttpError(400, 'weak_password');
    }

    throw error ?? new Error('createUser returned no user');
  }

  const id = data.user.id;

  // The role and the ci are written here, on the profile the trigger just
  // created:
  // - the trigger cannot see the role: GoTrue writes the app_metadata (where
  //   the role lives) after the insert, so the trigger only sees 'promoter';
  // - the ci is not trusted from user_metadata.
  const profile: {role: Role; ci?: string | null} = {role};

  if (ci) {
    profile.ci = ci;
  }

  const {error: profileError} = await admin
    .from('profiles')
    .update(profile)
    .eq('id', id);

  if (profileError) {
    // Lost a race for the same ci: do not leave a half-made user behind.
    await admin.auth.admin.deleteUser(id);

    throw profileError.code === '23505'
      ? new HttpError(409, 'ci_taken')
      : profileError;
  }

  return {id};
}

async function setPassword(body: Record<string, unknown>) {
  const userId = text(body.user_id);

  if (!UUID_PATTERN.test(userId)) {
    throw new HttpError(400, 'invalid_request');
  }

  const password = readPassword(body.password);
  const {error} = await admin.auth.admin.updateUserById(userId, {password});

  if (error) {
    if (error.code === 'user_not_found') {
      throw new HttpError(404, 'user_not_found');
    }

    if (error.code === 'weak_password') {
      throw new HttpError(400, 'weak_password');
    }

    if (error.code === 'same_password') {
      throw new HttpError(400, 'same_password');
    }

    throw error;
  }

  return {ok: true};
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: CORS_HEADERS});
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'invalid_request');
    }

    await requireAdministrator(req);

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'invalid_request');
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new HttpError(400, 'invalid_request');
    }

    const payload = body as Record<string, unknown>;

    switch (payload.action) {
      case 'create':
        return reply(200, await createUser(payload));
      case 'set_password':
        return reply(200, await setPassword(payload));
      default:
        throw new HttpError(400, 'invalid_request');
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return reply(error.status, {error: error.code});
    }

    console.error('admin-users failed', error);

    return reply(500, {error: 'server_error'});
  }
});
