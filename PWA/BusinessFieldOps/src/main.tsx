import 'mdui/mdui.css';
import '@material-design-icons/font/filled.css';
import 'mdui';
import {setColorScheme} from 'mdui/functions/setColorScheme.js';
import {useEffect} from 'preact/hooks';

import {AuthProvider, useAuth} from '@/lib/AuthContext';
import {requestPersistentStorage, useReferenceSync} from '@/lib/offline';

import './Global.css';

setColorScheme(import.meta.env.VITE_BUSINESS_COLOR_SCHEME || '#1976d2');

import {render} from 'preact';
import App from './App';

function OfflineSync() {
  const {profile} = useAuth();

  useReferenceSync(profile?.id);

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
