// ============================================
// AgentPit - Agent Event Routes
// ============================================

import { FastifyInstance } from 'fastify';
import { AgentIdParamSchema, EventQuerySchema } from '../schemas';
import { authGuard, getUserId } from '../middleware/auth';
import { AgentRepository } from '../../db/repositories/agents';
import { AgentEventRepository } from '../../db/repositories/agent-events';
import { createLogger } from '../../utils/logger';

const log = createLogger('EventRoutes');

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  const agentRepo = new AgentRepository();
  const eventRepo = new AgentEventRepository();

  app.addHook('preHandler', authGuard);

  /**
   * GET /agents/:agentId/events
   * List events for an agent (decisions, trades, errors, etc.)
   */
  app.get('/agents/:agentId/events', async (request, reply) => {
    const userId = getUserId(request);
    const { agentId } = AgentIdParamSchema.parse(request.params);
    const query = EventQuerySchema.parse(request.query);

    const agent = await agentRepo.getById(agentId);
    if (!agent || agent.userId !== userId) {
      return reply.status(404).send({ error: 'Agent not found' });
    }

    const events = await eventRepo.listByAgent(agentId, query.limit);
    return { events, total: events.length };
  });
}
