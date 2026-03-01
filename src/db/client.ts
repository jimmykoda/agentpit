// ============================================
// AgentPit - Supabase Client
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const log = createLogger('Database');

let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 */
export function initSupabase(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, anonKey } = config.supabase;

  if (!url || !anonKey) {
    throw new Error('Supabase URL and ANON_KEY must be configured');
  }

  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: false, // We're not using auth sessions
    },
  });

  log.info('Supabase client initialized');
  return supabaseClient;
}

/**
 * Get the Supabase client instance
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    return initSupabase();
  }
  return supabaseClient;
}
