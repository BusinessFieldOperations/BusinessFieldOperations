import 'mdui/mdui.css';
import '@material-design-icons/font/filled.css';
import 'mdui';
import {setColorScheme} from 'mdui/functions/setColorScheme.js';
import {useEffect} from 'preact/hooks';

import {AuthProvider, useAuth} from '@/lib/AuthContext';
import {
  requestPersistentStorage,
  useOutboxSync,
  useReferenceSync,
} from '@/lib/offline';
import {getLocale} from '@/paraglide/runtime.js';

import './Global.css';

setColorScheme(import.meta.env.VITE_BUSINESS_COLOR_SCHEME || '#1976d2');

// The active locale is detected from the stored preference or the browser's
// preferred language (see the Paraglide `strategy` in vite.config.ts). Reflect
// it on the document so the page language stays in sync.
document.documentElement.lang = getLocale();

import {render} from 'preact';
import App from './App';

function OfflineSync() {
  const {profile} = useAuth();

  useReferenceSync(profile?.id);
  useOutboxSync(profile?.is_active ? profile.id : undefined);

  useEffect(() => {
    if (profile?.id) {
      void requestPersistentStorage().catch(error => {
        console.warn('Persistent storage request failed:', error);
      });
    }
  }, [profile?.id]);

  return null;
}

render(
  <AuthProvider>
    <OfflineSync />
    <App />
  </AuthProvider>,
  document.getElementById('root')!,
);
