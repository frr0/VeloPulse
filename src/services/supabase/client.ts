import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DEMO_ONLY } from '../../config/demoOnly';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

/**
 * True when the app is configured to use Supabase Auth + PostgreSQL.
 * Always false on the locked public demo build (`VITE_DEMO_ONLY=1`).
 */
export const isSupabaseConfigured =
  !DEMO_ONLY && Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
