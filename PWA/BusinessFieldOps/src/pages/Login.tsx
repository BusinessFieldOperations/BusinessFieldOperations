import { route } from "preact-router";
import { useEffect, useState } from 'preact/hooks';
import "../App.css";
import "mdui/components/card.js";
import "mdui/components/text-field.js";
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active || !session) return;
      route('/dashboard', true);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      route('/dashboard');
    }
  };

  return (
    <main class="center-container">
      <h1 class="main-title">{import.meta.env.VITE_BUSINESS_NAME}</h1>
      <mdui-card variant="elevated" class="box">
        <h2 class="main-title">Login</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          <mdui-text-field
            icon="person"
            variant="outlined"
            label="Email"
            type="email"
            value={email}
            onInput={(e: any) => setEmail(e.target.value)}
            required
          >
          </mdui-text-field>

          <mdui-text-field
            icon="key"
            variant="outlined"
            label="Password"
            type="password"
            value={password}
            onInput={(e: any) => setPassword(e.target.value)}
            required
            toggle-password
          >
          </mdui-text-field>

          {errorMsg && <div class="error-message">{errorMsg}</div>}

          <mdui-button type="submit" variant="outlined" class="login-button" loading={loading ? true : undefined}>
            {loading ? 'Signing in...' : 'Login'}
          </mdui-button>
        </form>
      </mdui-card>
    </main>
  );
}