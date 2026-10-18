import {useLocation} from 'wouter-preact';
import {useEffect, useState} from 'preact/hooks';
import type {ComponentChildren} from 'preact';

import 'mdui/components/button.js';

import {useAuth} from '@/lib/AuthContext';
import {m} from '@/paraglide/messages.js';

export function RequireAuth({children}: {children: ComponentChildren}) {
  const {session, loading, profile, profileLoading, profileError, signOut} =
    useAuth();
  const [, navigate] = useLocation();
  const [signOutError, setSignOutError] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate('/login');
  }, [loading, session]);

  // DRAFT

  if (loading || (session && profileLoading)) {
    return (
      <main class="center-container">
        <h1 class="main-title">{m.loading()}</h1>
      </main>
    );
  }
  if (!session) return null;

  if (profileError || !profile || !profile.is_active) {
    const message = profileError
      ? m.profile_load_error()
      : !profile
        ? m.profile_not_linked()
        : m.account_inactive();

    return (
      <main class="center-container">
        <h1 class="main-title">{m.access_unavailable()}</h1>
        <p>{message}</p>
        {signOutError && <p role="alert">{m.sign_out_error()}</p>}
        <mdui-button
          variant="filled"
          icon="logout"
          onClick={async () => {
            const {error} = await signOut();
            setSignOutError(Boolean(error));
          }}
        >
          {m.signout()}
        </mdui-button>
      </main>
    );
  }

  return <>{children}</>;
}
