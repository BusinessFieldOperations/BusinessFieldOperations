import {useLocation} from 'wouter-preact';
import {useEffect} from 'preact/hooks';
import type {ComponentChildren} from 'preact';

import {useAuth} from '@/lib/AuthContext';

export function RequireAuth({children}: {children: ComponentChildren}) {
  const {session, loading} = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate('/login');
  }, [loading, session]);

  if (loading) return null; // or a spinner
  if (!session) return null;

  return <>{children}</>;
}
