import {useLocation} from 'wouter-preact';
import {useEffect, useState} from 'preact/hooks';
import type {ComponentChildren} from 'preact';
import 'mdui/components/button.js';

import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabase';

export function RequireAuth({children}: {children: ComponentChildren}) {
  const {session, loading, profile, profileLoading, profileError} = useAuth();
  const [, navigate] = useLocation();
  const [signOutError, setSignOutError] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate('/login');
  }, [loading, session]);

  // DRAFT

  if (loading || (session && profileLoading)) {
    return (
      <main class="center-container">
        <h1 class="main-title">Loading...</h1>
      </main>
    );
  }
  if (!session) return null;

  if (profileError || !profile || !profile.is_active) {
    const message = profileError
      ? 'Your profile could not be loaded.'
      : !profile
        ? 'No profile is associated with this account.'
        : 'This account is inactive.';

    return (
      <main class="center-container">
        <h1 class="main-title">Access unavailable</h1>
        <p>{message}</p>
        {signOutError && (
          <p role="alert">Could not sign out. Please try again.</p>
        )}
        <mdui-button
          variant="filled"
          icon="logout"
          onClick={async () => {
            const {error} = await supabase.auth.signOut();
            setSignOutError(Boolean(error));
          }}
        >
          Sign out
        </mdui-button>
      </main>
    );
  }

  return <>{children}</>;
}
