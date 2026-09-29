import {createContext} from 'preact';
import {useContext, useEffect, useState} from 'preact/hooks';
import type {ComponentChildren} from 'preact';
import type {Session} from '@supabase/supabase-js';

import {supabase} from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({session: null, loading: true});

export function AuthProvider({children}: {children: ComponentChildren}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read whatever session is already cached.
    supabase.auth
      .getSession()
      .then(({data}) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to retrieve session:', error);
      });

    // Subscribe to future changes: sign in, sign out, token refresh.
    const {data: listener} = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{session, loading}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
