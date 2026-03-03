// ============================================
// AgentPit - Trade & Position Routes
// ============================================

import { FastifyInstance } from 'fastify';
import { AgentIdParamSchema, TradeQuerySchema, PaginationSchema } from '../schemas';
import { authGuard, getUserId } from '../middleware/auth';
import { AgentRepository } from '../../db/repositories/agents';
import { TradeRepository } from '../../db/repositories/trades';
import { PositionRepository } from '../../db/repositories/positions';
import { createLogger } from '../../utils/logger';

const log = createLogger('TradeRoutes');

export async function tradeRoutes(app: FastifyInstance): Promise<void> {
  const agentRepo = new AgentRepository();
  const tradeRepo = new TradeRepository();
  const positionRepo = new PositionRepository();

  app.addHook('preHandler', authGuard);

  /**
   * GET /agents/:agentId/trades
   * List trades for an agent
   */
  app.get('/agents/:agentId/trades', async (request, reply) => {
    const userId = getUserId(request);
    const { agentId } = AgentIdParamSchema.parse(request.params);
    const query = TradeQuerySchema.parse(request.query);

    // Verify ownership
    const agent = await agentRepo.getById(agentId);
    if (!agent || agent.userId !== userId) {
      return reply.status(404).send({ error: 'Agent not found' });
    }

    const trades = await tradeRepo.listByAgent(agentId, query.limit);
    return { trades, total: trades.length };
  });

  /**
   * GET /agents/:agentId/positions
   * List open positions for an agent
   */
  app.get('/agents/:agentId/positions', async (request, reply) => {
    const userId = getUserId(request);
    const { agentId } = AgentIdParamSchema.parse(request.params);

    const agent = await agentRepo.getById(agentId);
    if (!agent || agent.userId !== userId) {
      return reply.status(404).send({ error: 'Agent not found' });
    }

    const positions = await positionRepo.listOpen(agentId);
    return { positions };
  });

  /**
   * GET /agents/:agentId/performance
   * Get P&L summary for an agent
   */
  app.get('/agents/:agentId/performance', async (request, reply) => {
    const userId = getUserId(request);
    const { agentId } = AgentIdParamSchema.parse(request.params);

    const agent = await agentRepo.getById(agentId);
    if (!agent || agent.userId !== userId) {
      return reply.status(404).send({ error: 'Agent not found' });
    }

    const trades = await tradeRepo.listByAgent(agentId, 1000);

    // Calculate performance metrics
    const closedTrades = trades.filter(t => t.action === 'close' && t.realizedPnl !== undefined);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.realizedPnl || 0) < 0);
    const winRate = closedTrades.length > 0
      ? (winningTrades.length / closedTrades.length) * 100
      : 0;
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((s, t) => s + (t.realizedPnl || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((s, t) => s + (t.realizedPnl || 0), 0) / losingTrades.length
      : 0;
    const profitFactor = avgLoss !== 0
      ? Math.abs(avgWin / avgLoss)
      : 0;

    return {
      agentId,
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: Math.round(winRate * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      bestTrade: winningTrades.length > 0
        ? Math.max(...winningTrades.map(t => t.realizedPnl || 0))
        : 0,
      worstTrade: losingTrades.length > 0
        ? Math.min(...losingTrades.map(t => t.realizedPnl || 0))
        : 0,
    };
  });

  /**
   * GET /trades/recent
   * Get recent trades across all user's agents
   */
  app.get('/trades/recent', async (request) => {
    const userId = getUserId(request);
    const query = PaginationSchema.parse(request.query);

    // Get all user's agents
    const agents = await agentRepo.listByUser(userId);
    const agentIds = agents.map(a => a.id);

    if (agentIds.length === 0) {
      return { trades: [] };
    }

    // Collect trades from all agents
    const allTrades: any[] = [];
    for (const id of agentIds) {
      const trades = await tradeRepo.listByAgent(id, query.limit);
      allTrades.push(...trades);
    }

    // Sort by timestamp desc and limit
    allTrades.sort((a, b) => b.timestamp - a.timestamp);
    return { trades: allTrades.slice(0, query.limit) };
  });
}
