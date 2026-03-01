// ============================================
// AgentPit - Positions Repository
// ============================================

import { getSupabase } from '../client';
import { Position } from '../../types';
import { createLogger } from '../../utils/logger';

const log = createLogger('PositionRepo');

export interface DBPosition {
  id: string;
  agent_id: string;
  symbol: string;
  side: string;
  size: number;
  entry_price: number;
  leverage: number;
  stop_loss: number | null;
  take_profit: number | null;
  unrealized_pnl: number;
  opened_at: string;
  closed_at: string | null;
}

export class PositionRepository {
  /**
   * Convert DB row to Position
   */
  private toPosition(dbPos: DBPosition): Position {
    return {
      id: dbPos.id,
      agentId: dbPos.agent_id,
      symbol: dbPos.symbol,
      side: dbPos.side as 'long' | 'short',
      size: Number(dbPos.size),
      entryPrice: Number(dbPos.entry_price),
      leverage: dbPos.leverage,
      stopLoss: dbPos.stop_loss !== null ? Number(dbPos.stop_loss) : undefined,
      takeProfit: dbPos.take_profit !== null ? Number(dbPos.take_profit) : undefined,
      unrealizedPnl: Number(dbPos.unrealized_pnl),
      openedAt: new Date(dbPos.opened_at).getTime(),
    };
  }

  /**
   * Convert Position to DB format
   */
  private toDBFormat(pos: Omit<Position, 'openedAt'>) {
    return {
      id: pos.id,
      agent_id: pos.agentId,
      symbol: pos.symbol,
      side: pos.side,
      size: pos.size,
      entry_price: pos.entryPrice,
      leverage: pos.leverage,
      stop_loss: pos.stopLoss ?? null,
      take_profit: pos.takeProfit ?? null,
      unrealized_pnl: pos.unrealizedPnl,
    };
  }

  /**
   * Create a new position
   */
  async create(position: Omit<Position, 'openedAt'>): Promise<Position> {
    const supabase = getSupabase();

    const dbData = this.toDBFormat(position);

    const { data, error } = await supabase
      .from('positions')
      .insert([dbData])
      .select()
      .single();

    if (error) {
      log.error('Failed to create position', error);
      throw error;
    }

    log.info(`Position opened: ${data.id} (${data.side} ${data.symbol})`);
    return this.toPosition(data);
  }

  /**
   * Get position by ID
   */
  async getById(id: string): Promise<Position | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Failed to get position', error);
      throw error;
    }

    return this.toPosition(data);
  }

  /**
   * Get open position for agent + symbol + side
   */
  async getOpenPosition(agentId: string, symbol: string, side: 'long' | 'short'): Promise<Position | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('symbol', symbol)
      .eq('side', side)
      .is('closed_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Failed to get open position', error);
      throw error;
    }

    return this.toPosition(data);
  }

  /**
   * List all open positions for an agent
   */
  async listOpen(agentId: string): Promise<Position[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('agent_id', agentId)
      .is('closed_at', null)
      .order('opened_at', { ascending: false });

    if (error) {
      log.error('Failed to list open positions', error);
      throw error;
    }

    return (data || []).map(this.toPosition);
  }

  /**
   * List all positions (open and closed) for an agent
   */
  async listByAgent(agentId: string, limit: number = 100): Promise<Position[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('agent_id', agentId)
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to list positions', error);
      throw error;
    }

    return (data || []).map(this.toPosition);
  }

  /**
   * Update position PnL
   */
  async updatePnL(id: string, unrealizedPnl: number): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('positions')
      .update({ unrealized_pnl: unrealizedPnl })
      .eq('id', id);

    if (error) {
      log.error('Failed to update position PnL', error);
      throw error;
    }
  }

  /**
   * Close a position
   */
  async close(id: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('positions')
      .update({ closed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      log.error('Failed to close position', error);
      throw error;
    }

    log.info(`Position closed: ${id}`);
  }

  /**
   * Delete positions for an agent
   */
  async deleteByAgent(agentId: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('agent_id', agentId);

    if (error) {
      log.error('Failed to delete positions', error);
      throw error;
    }

    log.info(`Positions deleted for agent: ${agentId}`);
  }
}
