import type {VNode} from 'preact';

import Home from './tabs/Home';
import Report from './tabs/Report';
import Contacts from './tabs/Contacts';
import Users from './tabs/Users';

import {UserRole} from '@/lib/profiles';

import {m} from '@/paraglide/messages.js';

/** Data every dashboard passes down; tabs pick what they need. */
export interface DashboardContext {
  userName: string;
  role: UserRole;
}

interface TabDefinition {
  icon: string;
  label: string;
  render: () => VNode;
}

export const TABS = {
  home: {
    icon: 'home',
    label: m.home(),
    render: () => <Home />,
  },
  reports: {
    icon: 'analytics',
    label: m.reports(),
    render: () => <Report />,
  },
  contacts: {
    icon: 'contacts',
    label: m.contacts(),
    render: () => <Contacts />,
  },
  users: {
    icon: 'manage_accounts',
    label: m.users(),
    render: () => <Users />,
  },
} satisfies Record<string, TabDefinition>;

export type TabId = keyof typeof TABS;
