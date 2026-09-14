import { route } from 'preact-router';
import 'mdui/components/avatar.js';
import 'mdui/components/badge.js';
import 'mdui/components/button.js';
import 'mdui/components/divider.js';

import { supabase } from '../lib/supabase';

interface Props {
  userName: string;
  role: string;
}

export default function HomeUserBox({ userName, role }: Props) {
  const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error.message);
      return;
    }

    route('/login', true);
  };

  return (
    <div class="user-box">
      <mdui-avatar src="/favicon.svg"></mdui-avatar>
      <p style={{ margin: 0 }}>{userName}</p>
      <mdui-badge>{capitalizedRole}</mdui-badge>
      <mdui-button
        variant="filled"
        icon="logout"
        onClick={handleLogout}
        type="button"
      >
        Logout
      </mdui-button>
      <mdui-divider></mdui-divider>
    </div>
  );
}
