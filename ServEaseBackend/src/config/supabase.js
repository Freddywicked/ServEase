/**
 * Lazily-initialised Supabase client.
 *
 * The client uses the SERVICE ROLE key, which bypasses Row Level Security.
 * It must therefore only ever live on the server - never ship it to the
 * mobile or web clients.
 * @format
 */

import { createClient } from '@supabase/supabase-js';
import config from './index.js';

let client = null;

export const getSupabase = () => {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    const error = new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
    );
    error.statusCode = 500;
    throw error;
  }
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};
