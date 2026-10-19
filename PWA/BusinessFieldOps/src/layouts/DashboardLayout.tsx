import './DashboardLayout.css';

import {Redirect, Route, Switch, useLocation} from 'wouter-preact';

import type {NavigationBar} from 'mdui/components/navigation-bar.js';
import 'mdui/components/layout.js';
import 'mdui/components/layout-main.js';
import 'mdui/components/navigation-bar.js';
import 'mdui/components/navigation-bar-item.js';

import {TABS, TabId} from '@/components/Tabs';
import MainTitle from '@/components/MainTitle';
import {ContactDialogs} from '@/components/contacts';
import {AdminTaskDialogs, TaskDialogs} from '@/components/tasks';
import {ReportViewDialog} from '@/components/reports';

interface Props {
  /** Tabs of the navigation bar, in order. The first one is the default. */
  tabs: readonly TabId[];
  /**
   * Tabs that have a route but no button in the bar: they are opened from
   * somewhere else (see `openDashboardTab`). While one is showing, no button
   * of the bar is highlighted.
   */
  hiddenTabs?: readonly TabId[];
  //   context: DashboardContext;
}

const NO_HIDDEN_TABS: readonly TabId[] = [];

export default function DashboardLayout({
  tabs,
  hiddenTabs = NO_HIDDEN_TABS,
}: Props) {
  const [LOCATION, navigate] = useLocation();
  const ACTIVE_TAB = LOCATION.split('/')[1] ?? '';
  const ROUTED_TABS = [...tabs, ...hiddenTabs];
  // A hidden tab is not in the bar. Leaving the bar without a value (instead
  // of keeping the previous one) means tapping any button is a real change.
  const NAV_VALUE = (tabs as readonly string[]).includes(ACTIVE_TAB)
    ? ACTIVE_TAB
    : '';

  const handleNavChange = (e: Event) => {
    const VALUE = (e.currentTarget as NavigationBar).value;
    if (VALUE && VALUE !== ACTIVE_TAB) navigate(`/${VALUE}`);
  };

  return (
    <>
      <mdui-layout full-height>
        <mdui-layout-main>
          <MainTitle />

          <Switch>
            {ROUTED_TABS.map(id => (
              <Route key={id} path={`/${id}`} nest>
                {TABS[id].render()}
              </Route>
            ))}
            <Route>
              <Redirect to={`/${tabs[0]}`} replace />
            </Route>
          </Switch>
        </mdui-layout-main>

        <mdui-navigation-bar
          value={NAV_VALUE}
          onChange={handleNavChange}
          label-visibility="labeled"
        >
          {tabs.map(id => (
            <mdui-navigation-bar-item key={id} value={id} icon={TABS[id].icon}>
              {TABS[id].label}
            </mdui-navigation-bar-item>
          ))}
        </mdui-navigation-bar>
      </mdui-layout>
      <TaskDialogs />
      <AdminTaskDialogs />
      <ReportViewDialog />
      <ContactDialogs />
    </>
  );
}
