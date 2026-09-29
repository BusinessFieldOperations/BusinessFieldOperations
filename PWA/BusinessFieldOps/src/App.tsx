import {Router, Switch, Route, Redirect} from 'wouter-preact';

import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import Welcome from '@/pages/Welcome';
import {RequireAuth} from '@/components/RequireAuth';
import {RedirectIfAuthed} from '@/components/RedirectIfAuthed';

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/">
          <Welcome />
        </Route>

        <Route path="/login">
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        </Route>

        <RequireAuth>
          <Route path="/dashboard" nest>
            <Dashboard />
          </Route>
        </RequireAuth>

        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Router>
  );
}

export default App;
