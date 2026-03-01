// ============================================
// AgentPit - Trades Repository
// ============================================

import { getSupabase } from '../client';
import { Trade } from '../../types';
import { createLogger } from '../../utils/logger';

const log = createLogger('TradeRepo');

export interface DBTrade {
  id: string;
  agent_id: string;
  symbol: string;
  side: string;
  action: string;
  size: number;
  price: number;
  leverage: number;
  realized_pnl: number | null;
  fee: number;
  reasoning: string | null;
  llm_decision: any; // JSONB
  timestamp: string;
}

export class TradeRepository {
  /**
   * Convert DB row to Trade
   */
  private toTrade(dbTrade: DBTrade): Trade {
    return {
      id: dbTrade.id,
      agentId: dbTrade.agent_id,
      symbol: dbTrade.symbol,
      side: dbTrade.side as 'long' | 'short',
      action: dbTrade.action as 'open' | 'close' | 'reduce',
      size: Number(dbTrade.size),
      price: Number(dbTrade.price),
      leverage: dbTrade.leverage,
      realizedPnl: dbTrade.realized_pnl !== null ? Number(dbTrade.realized_pnl) : undefined,
      fee: Number(dbTrade.fee),
      reasoning: dbTrade.reasoning || '',
      llmDecision: dbTrade.llm_decision,
      timestamp: new Date(dbTrade.timestamp).getTime(),
    };
  }

  /**
   * Convert Trade to DB format
   */
  private toDBFormat(trade: Omit<Trade, 'timestamp'>) {
    return {
      id: trade.id,
      agent_id: trade.agentId,
      symbol: trade.symbol,
      side: trade.side,
      action: trade.action,
      size: trade.size,
      price: trade.price,
      leverage: trade.leverage,
      realized_pnl: trade.realizedPnl ?? null,
      fee: trade.fee,
      reasoning: trade.reasoning,
      llm_decision: trade.llmDecision,
    };
  }

  /**
   * Log a trade
   */
  async create(trade: Omit<Trade, 'timestamp'>): Promise<Trade> {
    const supabase = getSupabase();

    const dbData = this.toDBFormat(trade);

    const { data, error } = await supabase
      .from('trades')
      .insert([dbData])
      .select()
      .single();

    if (error) {
      log.error('Failed to log trade', error);
      throw error;
    }

    log.info(`Trade logged: ${data.id} (${data.action} ${data.side} ${data.symbol})`);
    return this.toTrade(data);
  }

  /**
   * Get trade by ID
   */
  async getById(id: string): Promise<Trade | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Failed to get trade', error);
      throw error;
    }

    return this.toTrade(data);
  }

  /**
   * List trades for an agent
   */
  async listByAgent(agentId: string, limit: number = 100): Promise<Trade[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to list trades', error);
      throw error;
    }

    return (data || []).map(this.toTrade);
  }

  /**
   * List recent trades for an agent
   */
  async listRecent(agentId: string, hours: number = 24): Promise<Trade[]> {
    const supabase = getSupabase();

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('agent_id', agentId)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false });

    if (error) {
      log.error('Failed to list recent trades', error);
      throw error;
    }

    return (data || []).map(this.toTrade);
  }

  /**
   * Get total PnL for an agent
   */
  async getTotalPnL(agentId: string): Promise<number> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('trades')
      .select('realized_pnl')
      .eq('agent_id', agentId)
      .not('realized_pnl', 'is', null);

    if (error) {
      log.error('Failed to calculate total PnL', error);
      throw error;
    }

    if (!data || data.length === 0) return 0;

    return data.reduce((sum, t) => sum + Number(t.realized_pnl || 0), 0);
  }

  /**
   * Delete trades for an agent
   */
  async deleteByAgent(agentId: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('agent_id', agentId);

    if (error) {
      log.error('Failed to delete trades', error);
      throw error;
    }

    log.info(`Trades deleted for agent: ${agentId}`);
  }
}
