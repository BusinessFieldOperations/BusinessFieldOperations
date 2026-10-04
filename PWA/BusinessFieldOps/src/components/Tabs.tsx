import type {VNode} from 'preact';

import Home from './tabs/Home';
import Report from './tabs/Report';
import Contacts from './tabs/Contacts';
import Users from './tabs/Users';

import {UserRole} from '@/lib/profiles';

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
    label: 'Home',
    render: () => <Home />,
  },
  reports: {
    icon: 'analytics',
    label: 'Reports',
    render: () => <Report />,
  },
  contacts: {
    icon: 'contacts',
    label: 'Contacts',
    render: () => <Contacts />,
  },
  users: {
    icon: 'manage_accounts',
    label: 'Users',
    render: () => <Users />,
  },
} satisfies Record<string, TabDefinition>;

export type TabId = keyof typeof TABS;
