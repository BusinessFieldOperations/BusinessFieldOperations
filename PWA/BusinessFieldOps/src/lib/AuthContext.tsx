import {createContext} from 'preact';
import {useContext, useEffect, useRef, useState, useMemo, useCallback} from 'preact/hooks';
import type {ComponentChildren} from 'preact';
import type {Session, AuthError} from '@supabase/supabase-js';

import {getProfile} from '@/lib/profiles';
import type {UserProfile} from '@/lib/profiles';
import {supabase} from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: boolean;
  signOut: () => Promise<{error: AuthError | null}>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  profile: null,
  profileLoading: true,
  profileError: false,
  signOut: () => supabase.auth.signOut(),
});

export function AuthProvider({children}: {children: ComponentChildren}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const currentSession = useRef<Session | null>(null);

  useEffect(() => {
    let mounted = true;
    let profileRequest = 0;
    let authEventReceived = false;

    const updateSession = (newSession: Session | null) => {
      currentSession.current = newSession;
      setSession(newSession);
      setLoading(false);
      setProfile(null);
      setProfileError(false);

      const requestId = ++profileRequest;
      if (!newSession) {
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      const userId = newSession.user.id;

      if (!mounted || requestId !== profileRequest) return;

      void getProfile(userId)
        .then(userProfile => {
          if (mounted && requestId === profileRequest) {
            setProfile(userProfile);
          }
        })
        .catch(error => {
          console.error('Failed to retrieve profile:', error);
          if (mounted && requestId === profileRequest) {
            setProfileError(true);
          }
        })
        .finally(() => {
          if (mounted && requestId === profileRequest) {
            setProfileLoading(false);
          }
        });
    };

    const {data: listener} = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        authEventReceived = true;

        if (
          event === 'TOKEN_REFRESHED' &&
          newSession?.user.id === currentSession.current?.user.id
        ) {
          currentSession.current = newSession;
          setSession(newSession);
          return;
        }

        updateSession(newSession);
      },
    );

    supabase.auth
      .getSession()
      .then(({data, error}) => {
        if (!mounted || authEventReceived) return;
        if (error) throw error;
        updateSession(data.session);
      })
      .catch(error => {
        console.error('Failed to retrieve session:', error);
        if (!mounted || authEventReceived) return;
        setLoading(false);
        setProfileLoading(false);
      });

    return () => {
      mounted = false;
      profileRequest += 1;
      listener.subscription.unsubscribe();
    };
  }, []);

const signOut = useCallback(() => supabase.auth.signOut(), []);

const value = useMemo(
  () => ({session, loading, profile, profileLoading, profileError, signOut}),
  [session, loading, profile, profileLoading, profileError, signOut],
);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
