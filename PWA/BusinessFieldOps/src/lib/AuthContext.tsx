import {createContext} from 'preact';
import {
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'preact/hooks';
import type {ComponentChildren} from 'preact';
import type {Session, AuthError} from '@supabase/supabase-js';

import {getCachedProfile, getProfile} from '@/lib/profiles';
import type {UserProfile} from '@/lib/profiles';
import {supabase} from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: boolean;
  signOut: () => Promise<{error: AuthError | null}>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  profile: null,
  profileLoading: true,
  profileError: false,
  signOut: () => supabase.auth.signOut(),
  refreshProfile: async () => undefined,
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

      void (async () => {
        let cachedProfile: UserProfile | null = null;

        try {
          cachedProfile = await getCachedProfile(userId);
        } catch (error) {
          console.warn('Failed to retrieve cached profile:', error);
        }

        if (!mounted || requestId !== profileRequest) return;

        if (cachedProfile) {
          setProfile(cachedProfile);
          setProfileLoading(false);
        }

        try {
          const userProfile = await getProfile(userId);

          if (mounted && requestId === profileRequest) {
            setProfile(userProfile);
          }
        } catch (error) {
          console.error('Failed to retrieve profile:', error);
          if (mounted && requestId === profileRequest && !cachedProfile) {
            setProfileError(true);
          }
        } finally {
          if (mounted && requestId === profileRequest) {
            setProfileLoading(false);
          }
        }
      })();
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

  const refreshProfile = useCallback(async () => {
    const userId = currentSession.current?.user.id;

    if (!userId) {
      return;
    }

    try {
      setProfile(await getProfile(userId));
    } catch (error) {
      console.warn('Failed to refresh profile:', error);
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      profile,
      profileLoading,
      profileError,
      signOut,
      refreshProfile,
    }),
    [
      session,
      loading,
      profile,
      profileLoading,
      profileError,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
