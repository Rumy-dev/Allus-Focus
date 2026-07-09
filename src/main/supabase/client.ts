import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. Copie .env.example para .env e preencha.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
