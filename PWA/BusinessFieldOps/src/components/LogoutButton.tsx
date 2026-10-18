import 'mdui/components/button.js';
import {snackbar} from 'mdui/functions/snackbar.js';

import {useState, useEffect, useRef} from 'preact/hooks';
import {useAuth} from '@/lib/AuthContext';
import {m} from '@/paraglide/messages.js';

export default function LogoutButton() {
  const {signOut} = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const {error} = await signOut();
      if (mounted.current && error) {
        console.error('Sign out failed:', error.message);
        snackbar({
          message: m.sign_out_error(),
          placement: 'top',
        });
      }
    } catch (err) {
      if (mounted.current) {
        console.error('Sign out failed:', err);
        snackbar({
          message: m.sign_out_error(),
          placement: 'top',
        });
      }
    } finally {
      if (mounted.current) setSigningOut(false);
    }
  };

  return (
    <mdui-button icon="logout" disabled={signingOut} onClick={handleSignOut}>
      {signingOut ? m.signing_out() : m.signout()}
    </mdui-button>
  );
}
