import './Login.css';

import 'mdui/components/layout.js';
import 'mdui/components/layout-main.js';
import 'mdui/components/card.js';
import 'mdui/components/text-field.js';
import 'mdui/components/button.js';
import 'mdui/components/circular-progress.js';
import {snackbar} from 'mdui/functions/snackbar.js';

import {useState} from 'preact/hooks';
import type {JSX} from 'preact';
import {useLocation} from 'wouter-preact';

import MainTitle from '@/components/MainTitle';
import {supabase} from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleSubmit = async (e: JSX.TargetedEvent<HTMLFormElement, Event>) => {
    e.preventDefault();

    // mdui-text-field is form-associated, so native validation works.
    if (!e.currentTarget.reportValidity()) return;

    setLoading(true);
    const {error} = await supabase.auth.signInWithPassword({email, password});
    setLoading(false);

    if (error) {
      snackbar({message: error.message, placement: 'top'});
      return;
    }

    snackbar({message: 'Signed in', placement: 'top'});

    navigate('/dashboard');
  };

  return (
    <mdui-layout full-height>
      <mdui-layout-main class="centered-container">
        <mdui-card class="login-card" variant="elevated">
          <MainTitle />

          <form class="login-form" onSubmit={handleSubmit} noValidate={false}>
            <mdui-text-field
              label="Email"
              type="email"
              variant="outlined"
              autocomplete="email"
              required
              value={email}
              onInput={e =>
                setEmail((e.currentTarget as HTMLInputElement).value)
              }
            />

            <mdui-text-field
              label="Password"
              type="password"
              variant="outlined"
              toggle-password
              autocomplete="current-password"
              required
              minlength={6}
              value={password}
              onInput={e =>
                setPassword((e.currentTarget as HTMLInputElement).value)
              }
            />

            <mdui-button
              type="submit"
              full-width
              loading={loading}
              disabled={loading}
            >
              Sign in
            </mdui-button>
          </form>
        </mdui-card>
      </mdui-layout-main>
    </mdui-layout>
  );
}
