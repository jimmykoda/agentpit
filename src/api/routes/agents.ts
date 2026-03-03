// ============================================
// AgentPit - Agent Routes
// Full CRUD + lifecycle management
// ============================================

import { FastifyInstance } from 'fastify';
import { v4 as uuid } from 'uuid';
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  AgentIdParamSchema,
  PaginationSchema,
} from '../schemas';
import { authGuard, getUserId } from '../middleware/auth';
import { AgentRepository } from '../../db/repositories/agents';
import { AgentManager } from '../../engine/agent-manager';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';

const log = createLogger('AgentRoutes');

// Tier-based agent limits
const TIER_LIMITS: Record<string, number> = {
  free: 1,
  starter: 3,
  pro: 10,
  whale: 50,
};

export function agentRoutes(manager: AgentManager) {
  return async function (app: FastifyInstance): Promise<void> {
    const agentRepo = new AgentRepository();

    // All routes require auth
    app.addHook('preHandler', authGuard);

    /**
     * GET /agents
     * List user's agents
     */
    app.get('/agents', async (request) => {
      const userId = getUserId(request);
      const query = PaginationSchema.parse(request.query);

      const agents = await agentRepo.listByUser(userId, query.limit, query.offset);
      return { agents, total: agents.length };
    });

    /**
     * POST /agents
     * Create a new agent
     */
    app.post('/agents', async (request, reply) => {
      const userId = getUserId(request);
      const body = CreateAgentSchema.parse(request.body);

      // Check tier limits
      const userAgents = await agentRepo.listByUser(userId);
      const tier = 'free'; // TODO: get from user record
      const limit = TIER_LIMITS[tier] || 1;

      if (userAgents.length >= limit) {
        return reply.status(403).send({
          error: 'Agent limit reached',
          message: `Your ${tier} tier allows ${limit} agent(s). Upgrade to create more.`,
          currentCount: userAgents.length,
          limit,
        });
      }

      // Build agent config
      const agentConfig = {
        id: uuid(),
        name: body.name,
        userId,
        llmProvider: body.llmProvider as any,
        llmModel: body.llmModel || getDefaultModel(body.llmProvider),
        symbol: body.symbol.toUpperCase(),
        maxPositionSize: body.maxPositionSize,
        maxLeverage: body.maxLeverage,
        decisionIntervalMs: body.decisionIntervalMs,
        strategy: {
          template: body.strategy.template as any,
          customPrompt: body.strategy.customPrompt,
          timeframes: body.strategy.timeframes as any[],
          indicators: body.strategy.indicators,
        },
        risk: body.risk || {
          maxDrawdownPercent: config.agent.defaultMaxDrawdown,
          maxDailyLossPercent: config.agent.defaultMaxDailyLoss,
          stopLossPercent: config.agent.defaultStopLoss,
          takeProfitPercent: config.agent.defaultTakeProfit,
          maxOpenPositions: config.agent.defaultMaxOpenPositions,
          cooldownAfterLossMs: config.agent.defaultCooldownMs,
        },
        status: 'idle' as const,
      };

      const created = await manager.createAgent(agentConfig);

      log.info(`Agent created: ${created.id} by user ${userId}`);
      return reply.status(201).send({ agent: created });
    });

    /**
     * GET /agents/:agentId
     * Get agent details
     */
    app.get('/agents/:agentId', async (request, reply) => {
      const userId = getUserId(request);
      const { agentId } = AgentIdParamSchema.parse(request.params);

      const agent = await agentRepo.getById(agentId);
      if (!agent || agent.userId !== userId) {
        return reply.status(404).send({ error: 'Agent not found' });
      }

      // Include runtime info if running
      const managed = manager.getAgent(agentId);
      const runtime = managed ? {
        isRunning: true,
        cycleCount: managed.cycleCount,
      } : {
        isRunning: false,
      };

      return { agent, runtime };
    });

    /**
     * PATCH /agents/:agentId
     * Update agent config (must be stopped/idle)
     */
    app.patch('/agents/:agentId', async (request, reply) => {
      const userId = getUserId(request);
      const { agentId } = AgentIdParamSchema.parse(request.params);
      const updates = UpdateAgentSchema.parse(request.body);

      const agent = await agentRepo.getById(agentId);
      if (!agent || agent.userId !== userId) {
        return reply.status(404).send({ error: 'Agent not found' });
      }

      // Can't update while running
      if (agent.status === 'running') {
        return reply.status(409).send({
          error: 'Agent is running',
          message: 'Stop the agent before updating its config',
        });
      }

      const updated = await agentRepo.update(agentId, updates as any);
      return { agent: updated };
    });

    /**
     * DELETE /agents/:agentId
     * Delete an agent
     */
    app.delete('/agents/:agentId', async (request, reply) => {
      const userId = getUserId(request);
      const { agentId } = AgentIdParamSchema.parse(request.params);

      const agent = await agentRepo.getById(agentId);
      if (!agent || agent.userId !== userId) {
        return reply.status(404).send({ error: 'Agent not found' });
      }

      await manager.removeAgent(agentId);
      return { success: true, message: `Agent ${agent.name} deleted` };
    });

    // --- Lifecycle ---

    /**
     * POST /agents/:agentId/start
     */
    app.post('/agents/:agentId/start', async (request, reply) => {
      const userId = getUserId(request);
      const { agentId } = AgentIdParamSchema.parse(request.params);

      const agent = await agentRepo.getById(agentId);
      if (!agent || agent.userId !== userId) {
        return reply.status(404).send({ error: 'Agent not found' });
      }

      if (agent.status === 'running') {
        return reply.status(409).send({ error: 'Agent is already running' });
      }

      await manager.startAgent(agentId);
      return { success: true, message: `Agent ${agent.name} started` };
    });

    /**
     * POST /agents/:agentId/stop
     */
    app.post('/agents/:agentId/stop', async (request, reply) => {
      const userId = getUserId(request);
      const { agentId } = AgentIdParamSchema.parse(request.params);

      const agent = await agentRepo.getById(agentId);
      if (!agent || agent.userId !== userId) {
        return reply.status(404).send({ error: 'Agent not found' });
      }

      await manager.stopAgent(agentId);
      return { success: true, message: `Agent ${agent.name} stopped` };
    });

    /**
     * POST /agents/:agentId/pause
     */
    app.post('/agents/:agentId/pause', async (request, reply) => {
      const userId = getUserId(request);
      const { agentId } = AgentIdParamSchema.parse(request.params);

      const agent = await agentRepo.getById(agentId);
      if (!agent || agent.userId !== userId) {
        return reply.status(404).send({ error: 'Agent not found' });
      }

      await manager.pauseAgent(agentId);
      return { success: true, message: `Agent ${agent.name} paused` };
    });
  };
}

// --- Helpers ---

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'deepseek': return config.llm.deepseek.model;
    case 'openai': return config.llm.openai.model;
    case 'anthropic': return config.llm.anthropic.model;
    default: return 'deepseek-chat';
  }
}
