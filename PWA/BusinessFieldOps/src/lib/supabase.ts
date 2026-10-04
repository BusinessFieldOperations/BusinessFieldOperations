import {createClient} from '@supabase/supabase-js';

import type {Database} from '@/lib/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_DATABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables in .env');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
