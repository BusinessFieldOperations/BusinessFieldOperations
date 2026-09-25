import {createClient} from '@supabase/supabase-js';
import * as offline from './offline';

const supabaseUrl = import.meta.env.VITE_SUPABASE_DATABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Try to sync drafts when coming online
if (typeof window !== 'undefined' && 'addEventListener' in window) {
  window.addEventListener('online', async () => {
    try {
      await offline.syncDrafts(supabase);
    } catch (err) {
      console.warn('Failed to sync drafts on online event', err);
    }
  });
}

export const offlineApi = offline;
