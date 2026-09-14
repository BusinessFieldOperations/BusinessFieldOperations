import { route } from "preact-router";
import { useEffect, useState } from 'preact/hooks';
import "mdui/components/button.js";
import "../App.css";
import { supabase } from '../lib/supabase';

export default function Welcome() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setHasSession(Boolean(session));
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main class="center-container">
      <h1 class="main-title">{import.meta.env.VITE_BUSINESS_NAME}</h1>
      <mdui-button
        icon="chevron_right"
        variant="outlined"
        onClick={() => route(hasSession ? "/dashboard" : "/login")}
      >
        {hasSession ? 'Dashboard' : 'Let Start'}
      </mdui-button>
    </main>
  );
}
