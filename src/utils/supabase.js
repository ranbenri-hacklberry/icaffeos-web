import { createClient } from '@supabase/supabase-js';

const isProd = import.meta.env.PROD;

export const supabaseUrl = isProd
  ? 'https://bezyhnewyzwkgnrvnqli.supabase.co'
  : (import.meta.env.VITE_LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321');

export const supabaseKey = isProd
  ? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
  : (import.meta.env.VITE_LOCAL_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH');

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storageKey: 'icaffe_loyalty_auth_token',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export default supabase;
