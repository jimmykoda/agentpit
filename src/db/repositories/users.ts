// ============================================
// AgentPit - Users Repository
// ============================================

import { getSupabase } from '../client';
import { createLogger } from '../../utils/logger';

const log = createLogger('UserRepo');

export interface DBUser {
  id: string;
  wallet_address: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  /**
   * Create a new user
   */
  async create(data: { wallet_address?: string; email?: string }): Promise<DBUser> {
    const supabase = getSupabase();

    const { data: user, error } = await supabase
      .from('users')
      .insert([data])
      .select()
      .single();

    if (error) {
      log.error('Failed to create user', error);
      throw error;
    }

    log.info(`User created: ${user.id}`);
    return user;
  }

  /**
   * Get user by ID
   */
  async getById(id: string): Promise<DBUser | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Failed to get user', error);
      throw error;
    }

    return data;
  }

  /**
   * Get user by wallet address
   */
  async getByWallet(wallet: string): Promise<DBUser | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', wallet)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Failed to get user by wallet', error);
      throw error;
    }

    return data;
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<DBUser | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Failed to get user by email', error);
      throw error;
    }

    return data;
  }

  /**
   * Update user
   */
  async update(id: string, data: { wallet_address?: string; email?: string }): Promise<DBUser> {
    const supabase = getSupabase();

    const { data: user, error } = await supabase
      .from('users')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Failed to update user', error);
      throw error;
    }

    log.info(`User updated: ${id}`);
    return user;
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      log.error('Failed to delete user', error);
      throw error;
    }

    log.info(`User deleted: ${id}`);
  }

  /**
   * List all users
   */
  async list(): Promise<DBUser[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to list users', error);
      throw error;
    }

    return data || [];
  }
}
