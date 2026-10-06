import {useLocation} from 'wouter-preact';

import 'mdui/components/layout.js';
import 'mdui/components/layout-main.js';
import 'mdui/components/button.js';

import MainTitle from '@/components/MainTitle';
import {m} from '@/paraglide/messages.js';
import {useAuth} from '@/lib/AuthContext';

export default function Welcome() {
  const {session, loading} = useAuth();
  const [, navigate] = useLocation();
  return (
    <mdui-layout full-height>
      <mdui-layout-main class="centered-container">
        <MainTitle />
        <mdui-button
          icon="chevron_right"
          variant="outlined"
          onClick={() =>
            navigate(!loading && session ? '/dashboard' : '/login')
          }
        >
          {!loading && session ? m.dashboard() : m.signin()}
        </mdui-button>
      </mdui-layout-main>
    </mdui-layout>
  );
}
