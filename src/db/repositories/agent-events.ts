// ============================================
// AgentPit - Agent Events Repository
// ============================================

import { getSupabase } from '../client';
import { AgentEvent } from '../../types';
import { createLogger } from '../../utils/logger';

const log = createLogger('EventRepo');

export interface DBAgentEvent {
  id: string;
  agent_id: string;
  event_type: string;
  data: any; // JSONB
  timestamp: string;
}

export class AgentEventRepository {
  /**
   * Convert DB row to AgentEvent
   */
  private toAgentEvent(dbEvent: DBAgentEvent): AgentEvent {
    const timestamp = new Date(dbEvent.timestamp).getTime();
    const agentId = dbEvent.agent_id;

    switch (dbEvent.event_type) {
      case 'decision':
        return {
          type: 'decision',
          agentId,
          decision: dbEvent.data,
          timestamp,
        };
      case 'trade':
        return {
          type: 'trade',
          agentId,
          trade: dbEvent.data,
          timestamp,
        };
      case 'error':
        return {
          type: 'error',
          agentId,
          error: dbEvent.data.error,
          timestamp,
        };
      case 'status_change':
        return {
          type: 'status_change',
          agentId,
          from: dbEvent.data.from,
          to: dbEvent.data.to,
          timestamp,
        };
      case 'risk_alert':
        return {
          type: 'risk_alert',
          agentId,
          alert: dbEvent.data.alert,
          timestamp,
        };
      default:
        throw new Error(`Unknown event type: ${dbEvent.event_type}`);
    }
  }

  /**
   * Log an agent event
   */
  async log(event: AgentEvent): Promise<void> {
    const supabase = getSupabase();

    let eventData: any = {};

    switch (event.type) {
      case 'decision':
        eventData = event.decision;
        break;
      case 'trade':
        eventData = event.trade;
        break;
      case 'error':
        eventData = { error: event.error };
        break;
      case 'status_change':
        eventData = { from: event.from, to: event.to };
        break;
      case 'risk_alert':
        eventData = { alert: event.alert };
        break;
    }

    const { error } = await supabase
      .from('agent_events')
      .insert([{
        agent_id: event.agentId,
        event_type: event.type,
        data: eventData,
      }]);

    if (error) {
      log.error('Failed to log agent event', error);
      throw error;
    }
  }

  /**
   * Get recent events for an agent
   */
  async listByAgent(agentId: string, limit: number = 100): Promise<AgentEvent[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('agent_events')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to list agent events', error);
      throw error;
    }

    return (data || []).map(this.toAgentEvent);
  }

  /**
   * Get events by type for an agent
   */
  async listByType(agentId: string, eventType: string, limit: number = 100): Promise<AgentEvent[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('agent_events')
      .select('*')
      .eq('agent_id', agentId)
      .eq('event_type', eventType)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to list agent events by type', error);
      throw error;
    }

    return (data || []).map(this.toAgentEvent);
  }

  /**
   * Get events in a time range
   */
  async listByTimeRange(agentId: string, startTime: Date, endTime: Date): Promise<AgentEvent[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('agent_events')
      .select('*')
      .eq('agent_id', agentId)
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      log.error('Failed to list events by time range', error);
      throw error;
    }

    return (data || []).map(this.toAgentEvent);
  }

  /**
   * Delete events for an agent
   */
  async deleteByAgent(agentId: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('agent_events')
      .delete()
      .eq('agent_id', agentId);

    if (error) {
      log.error('Failed to delete agent events', error);
      throw error;
    }

    log.info(`Events deleted for agent: ${agentId}`);
  }

  /**
   * Delete old events (cleanup)
   */
  async deleteOlderThan(days: number): Promise<void> {
    const supabase = getSupabase();

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('agent_events')
      .delete()
      .lt('timestamp', cutoff);

    if (error) {
      log.error('Failed to delete old events', error);
      throw error;
    }

    log.info(`Events older than ${days} days deleted`);
  }
}
