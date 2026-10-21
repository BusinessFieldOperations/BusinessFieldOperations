import {useState} from 'preact/hooks';
import {Router, Switch, Route, Redirect} from 'wouter-preact';

import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import Splash from '@/pages/Splash';
import Welcome from '@/pages/Welcome';
import {RequireAuth} from '@/components/RequireAuth';
import {RedirectIfAuthed} from '@/components/RedirectIfAuthed';
import {hasAcceptedTerms} from '@/lib/firstRun';

function App() {
  // The terms of use are shown once, on the first run of the app.
  const [termsAccepted, setTermsAccepted] = useState(hasAcceptedTerms);

  if (!termsAccepted) {
    return <Splash onAccepted={() => setTermsAccepted(true)} />;
  }

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
