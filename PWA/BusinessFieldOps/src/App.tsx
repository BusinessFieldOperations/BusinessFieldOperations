import { Router, Route, route } from "preact-router";
import { useEffect, useState } from 'preact/hooks';
import "./App.css";

import { supabase } from './lib/supabase';
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Dashboard from './pages/Dashboard';

function App() {
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let active = true;

    const finishCheck = () => {
      if (active) {
        setSessionChecked(true);
      }
    };

    // Check the current session on first load
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!active) return;

        if (session) {
          if (window.location.pathname !== '/dashboard') {
            route('/dashboard', true);
          }
        } else if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          route('/login', true); // Replace history state so they can't hit "Back"
        }

        finishCheck();
      })
      .catch(() => {
        finishCheck();
      });

    // Listen for authentication state changes (e.g., token expires, or user logs out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        if (window.location.pathname !== '/dashboard') {
          route('/dashboard', true);
        }
      } else if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        route('/login', true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Render a lightweight loading state instead of an empty root while the auth check resolves.
  if (!sessionChecked) {
    return (
      <main class="center-container">
        <h1 class="main-title">Loading...</h1>
      </main>
    );
  }

  return (
    <Router>
      <Route path="/" component={Welcome} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
    </Router>
  );
}

export default App;
