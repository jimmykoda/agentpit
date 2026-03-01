// ============================================
// AgentPit - API Keys Repository (BYOK)
// ============================================

import { getSupabase } from '../client';
import { encrypt, decrypt } from '../../utils/encryption';
import { createLogger } from '../../utils/logger';

const log = createLogger('ApiKeyRepo');

export interface DBApiKey {
  id: string;
  user_id: string;
  provider: string;
  encrypted_key: string;
  created_at: string;
}

export class ApiKeyRepository {
  /**
   * Store an encrypted API key
   */
  async create(userId: string, provider: string, apiKey: string): Promise<string> {
    const supabase = getSupabase();

    // Encrypt the key
    const encryptedKey = encrypt(apiKey);

    const { data, error } = await supabase
      .from('api_keys')
      .insert([{
        user_id: userId,
        provider,
        encrypted_key: encryptedKey,
      }])
      .select()
      .single();

    if (error) {
      log.error('Failed to store API key', error);
      throw error;
    }

    log.info(`API key stored for user ${userId}, provider ${provider}`);
    return data.id;
  }

  /**
   * Get decrypted API key for a user + provider
   */
  async get(userId: string, provider: string): Promise<string | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Failed to get API key', error);
      throw error;
    }

    // Decrypt and return
    try {
      return decrypt(data.encrypted_key);
    } catch (err) {
      log.error('Failed to decrypt API key', err);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Update an API key
   */
  async update(userId: string, provider: string, apiKey: string): Promise<void> {
    const supabase = getSupabase();

    // Encrypt the new key
    const encryptedKey = encrypt(apiKey);

    const { error } = await supabase
      .from('api_keys')
      .update({ encrypted_key: encryptedKey })
      .eq('user_id', userId)
      .eq('provider', provider);

    if (error) {
      log.error('Failed to update API key', error);
      throw error;
    }

    log.info(`API key updated for user ${userId}, provider ${provider}`);
  }

  /**
   * Delete an API key
   */
  async delete(userId: string, provider: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    if (error) {
      log.error('Failed to delete API key', error);
      throw error;
    }

    log.info(`API key deleted for user ${userId}, provider ${provider}`);
  }

  /**
   * List all providers for a user
   */
  async listProviders(userId: string): Promise<string[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('api_keys')
      .select('provider')
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to list providers', error);
      throw error;
    }

    return (data || []).map(row => row.provider);
  }

  /**
   * Delete all API keys for a user
   */
  async deleteByUser(userId: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to delete user API keys', error);
      throw error;
    }

    log.info(`All API keys deleted for user: ${userId}`);
  }
}
