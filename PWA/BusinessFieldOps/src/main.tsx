import 'mdui/mdui.css';
import '@material-design-icons/font/filled.css';
import 'mdui';
import {setColorScheme} from 'mdui/functions/setColorScheme.js';

import {AuthProvider} from '@/lib/AuthContext';

import './Global.css';

setColorScheme(import.meta.env.VITE_BUSINESS_COLOR_SCHEME || '#1976d2');

import {render} from 'preact';
import App from './App';

render(
  <AuthProvider>
    <App />
  </AuthProvider>,
  document.getElementById('root')!,
);
