import 'mdui/components/button.js';
import { snackbar } from 'mdui/functions/snackbar.js';

import { useState, useEffect, useRef } from 'preact/hooks';
import { useAuth } from '@/lib/AuthContext';

export default function LogoutButton() {
    const { signOut } = useAuth();
    const [signingOut, setSigningOut] = useState(false);
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    const handleSignOut = async () => {
        setSigningOut(true);
        try {
            const { error } = await signOut();
            if (mounted.current && error) {
                console.error('Sign out failed:', error.message);
                snackbar({ message: 'Could not sign out. Please try again.', placement: 'top' });
            }
        } catch (err) {
            if (mounted.current) {
                console.error('Sign out failed:', err);
                snackbar({ message: 'Could not sign out. Please try again.', placement: 'top' });
            }
        } finally {
            if (mounted.current) setSigningOut(false);
        }
    };

    return (
        <mdui-button
            icon="logout"
            disabled={signingOut}
            onClick={handleSignOut}
        >
            {signingOut ? 'Signing out...' : 'Sign out'}
        </mdui-button>
    );
}
