// ============================================
// AgentPit - Agents Repository
// ============================================

import { getSupabase } from '../client';
import { AgentConfig, AgentStatus, StrategyConfig, RiskConfig } from '../../types';
import { createLogger } from '../../utils/logger';

const log = createLogger('AgentRepo');

export interface DBAgent {
  id: string;
  user_id: string;
  name: string;
  llm_provider: string;
  llm_model: string;
  symbol: string;
  strategy_template: string;
  strategy_config: any; // JSONB
  risk_config: any; // JSONB
  status: string;
  max_leverage: number;
  max_position_size: number;
  decision_interval_ms: number;
  created_at: string;
  updated_at: string;
}

export class AgentRepository {
  /**
   * Convert DB row to AgentConfig
   */
  private toAgentConfig(dbAgent: DBAgent): AgentConfig {
    return {
      id: dbAgent.id,
      name: dbAgent.name,
      userId: dbAgent.user_id,
      llmProvider: dbAgent.llm_provider as any,
      llmModel: dbAgent.llm_model,
      symbol: dbAgent.symbol,
      maxPositionSize: Number(dbAgent.max_position_size),
      maxLeverage: dbAgent.max_leverage,
      decisionIntervalMs: dbAgent.decision_interval_ms,
      strategy: dbAgent.strategy_config as StrategyConfig,
      risk: dbAgent.risk_config as RiskConfig,
      status: dbAgent.status as AgentStatus,
      createdAt: new Date(dbAgent.created_at).getTime(),
      updatedAt: new Date(dbAgent.updated_at).getTime(),
    };
  }

  /**
   * Convert AgentConfig to DB format
   */
  private toDBFormat(config: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    return {
      user_id: config.userId,
      name: config.name,
      llm_provider: config.llmProvider,
      llm_model: config.llmModel,
      symbol: config.symbol,
      strategy_template: config.strategy.template,
      strategy_config: config.strategy,
      risk_config: config.risk,
      status: config.status,
      max_leverage: config.maxLeverage,
      max_position_size: config.maxPositionSize,
      decision_interval_ms: config.decisionIntervalMs,
    };
  }

  /**
   * Create a new agent
   */
  async create(config: Omit<AgentConfig, 'createdAt' | 'updatedAt'>): Promise<AgentConfig> {
    const supabase = getSupabase();

    const dbData = this.toDBFormat(config);

    const { data, error } = await supabase
      .from('agents')
      .insert([{ id: config.id, ...dbData }])
      .select()
      .single();

    if (error) {
      log.error('Failed to create agent', error);
      throw error;
    }

    log.info(`Agent created: ${data.id} (${data.name})`);
    return this.toAgentConfig(data);
  }

  /**
   * Get agent by ID
   */
  async getById(id: string): Promise<AgentConfig | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Failed to get agent', error);
      throw error;
    }

    return this.toAgentConfig(data);
  }

  /**
   * List all agents for a user
   */
  async listByUser(userId: string, limit?: number, offset?: number): Promise<AgentConfig[]> {
    const supabase = getSupabase();

    let query = supabase
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (limit !== undefined) {
      const from = offset || 0;
      query = query.range(from, from + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to list agents', error);
      throw error;
    }

    return (data || []).map(this.toAgentConfig);
  }

  /**
   * List agents by status
   */
  async listByStatus(status: AgentStatus): Promise<AgentConfig[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to list agents by status', error);
      throw error;
    }

    return (data || []).map(this.toAgentConfig);
  }

  /**
   * List all agents
   */
  async list(): Promise<AgentConfig[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to list all agents', error);
      throw error;
    }

    return (data || []).map(this.toAgentConfig);
  }

  /**
   * Update agent status
   */
  async updateStatus(id: string, status: AgentStatus): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('agents')
      .update({ status })
      .eq('id', id);

    if (error) {
      log.error('Failed to update agent status', error);
      throw error;
    }

    log.info(`Agent ${id} status updated: ${status}`);
  }

  /**
   * Update agent configuration
   */
  async update(id: string, config: Partial<Omit<AgentConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<AgentConfig> {
    const supabase = getSupabase();

    const updateData: any = {};

    if (config.name) updateData.name = config.name;
    if (config.llmProvider) updateData.llm_provider = config.llmProvider;
    if (config.llmModel) updateData.llm_model = config.llmModel;
    if (config.symbol) updateData.symbol = config.symbol;
    if (config.maxPositionSize) updateData.max_position_size = config.maxPositionSize;
    if (config.maxLeverage) updateData.max_leverage = config.maxLeverage;
    if (config.decisionIntervalMs) updateData.decision_interval_ms = config.decisionIntervalMs;
    if (config.strategy) {
      updateData.strategy_template = config.strategy.template;
      updateData.strategy_config = config.strategy;
    }
    if (config.risk) updateData.risk_config = config.risk;
    if (config.status) updateData.status = config.status;

    const { data, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Failed to update agent', error);
      throw error;
    }

    log.info(`Agent updated: ${id}`);
    return this.toAgentConfig(data);
  }

  /**
   * Delete agent
   */
  async delete(id: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) {
      log.error('Failed to delete agent', error);
      throw error;
    }

    log.info(`Agent deleted: ${id}`);
  }
}
