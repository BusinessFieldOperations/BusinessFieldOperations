import {useLocation} from 'wouter-preact';
import {useEffect} from 'preact/hooks';
import type {ComponentChildren} from 'preact';

import {useAuth} from '@/lib/AuthContext';

export function RedirectIfAuthed({children}: {children: ComponentChildren}) {
  const {session, loading} = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && session) navigate('/dashboard');
  }, [loading, session]);

  if (loading) return null;
  if (session) return null;

  return <>{children}</>;
}
