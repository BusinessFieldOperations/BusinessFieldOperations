import './DashboardLayout.css';

import {Redirect, Route, Switch, useLocation} from 'wouter-preact';

import type {NavigationBar} from 'mdui/components/navigation-bar.js';
import 'mdui/components/layout.js';
import 'mdui/components/layout-main.js';
import 'mdui/components/navigation-bar.js';
import 'mdui/components/navigation-bar-item.js';

import {TABS, TabId} from '@/components/Tabs';
import MainTitle from '@/components/MainTitle';

interface Props {
  tabs: readonly TabId[];
  //   context: DashboardContext;
}

export default function DashboardLayout({tabs}: Props) {
  const [LOCATION, navigate] = useLocation();
  const ACTIVE_TAB = LOCATION.split('/')[1] ?? '';

  const handleNavChange = (e: Event) => {
    const VALUE = (e.currentTarget as NavigationBar).value;
    if (VALUE && VALUE !== ACTIVE_TAB) navigate(`/${VALUE}`);
  };

  return (
    <mdui-layout full-height>
      <mdui-layout-main>
        <MainTitle />

        <Switch>
          {tabs.map(id => (
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
        value={ACTIVE_TAB}
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
  );
}
