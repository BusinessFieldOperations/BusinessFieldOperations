import './Home.css';

import 'mdui/components/divider.js';

import HeroCard from '@/components/HeroCard';
import LogoutButton from '@/components/LogoutButton';

import {useAuth} from '@/lib/AuthContext';
import type {UserRole} from '@/lib/profiles';
import {HomeTasks} from '@/components/tasks';
import {m} from '@/paraglide/messages.js';
import {Fragment} from 'preact/jsx-runtime';

const ROLE_LABELS: Record<UserRole, () => string> = {
  merchant: () => m.merchant(),
  promoter: () => m.promoter(),
  administrator: () => m.administrator(),
};

export default function Home() {
  const {profile, profileLoading, profileError} = useAuth();

  if (profileLoading) {
    return (
      <main class="centered-container" aria-live="polite">
        <p>{m.profile_loading()}</p>
      </main>
    );
  }

  if (profileError || !profile) {
    return (
      <main class="centered-container">
        <p role="alert">
          {profileError ? m.profile_load_error() : m.profile_unavailable()}
        </p>
      </main>
    );
  }

  return (
    <Fragment>
      <header class="centered-container">
        <HeroCard
          avatarIcon="person"
          avatarAlt={`${profile.first_name} ${profile.last_name}`}
          title={`${profile.first_name} ${profile.last_name}`}
          chips={[ROLE_LABELS[profile.role]()]}
          badge={profile.is_active ? '' : m.inactive()}
        />
        <LogoutButton></LogoutButton>
      </header>

      <mdui-divider></mdui-divider>

      {/* Admin: Assign, review task*/}
      <HomeTasks />
    </Fragment>
  );
}
