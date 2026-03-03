// ============================================
// AgentPit - Health & Status Routes
// ============================================

import { FastifyInstance } from 'fastify';
import { AgentManager } from '../../engine/agent-manager';

export function healthRoutes(manager: AgentManager) {
  return async function (app: FastifyInstance): Promise<void> {

    /**
     * GET /health
     * Basic health check
     */
    app.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
      };
    });

    /**
     * GET /status
     * Detailed platform status
     */
    app.get('/status', async () => {
      const activeAgents = manager.listAgents();
      const schedulerStats = await manager.getSchedulerStats();

      return {
        status: 'ok',
        version: '1.0.0',
        engine: {
          activeAgents: activeAgents.length,
          agents: activeAgents.map(a => ({
            id: a.config.id,
            name: a.config.name,
            symbol: a.config.symbol,
            status: a.config.status,
            cycles: a.cycleCount,
          })),
        },
        scheduler: schedulerStats,
        memory: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
        uptime: Math.round(process.uptime()),
        timestamp: Date.now(),
      };
    });
  };
}
