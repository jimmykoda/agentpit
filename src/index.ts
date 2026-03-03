// ============================================
// AgentPit - Main Entry Point
// Boots the trading engine + REST API server
// ============================================

import { MarketDataService } from './market/market-data';
import { IndicatorEngine } from './indicators/indicator-engine';
import { LLMRouter } from './llm/llm-router';
import { RiskManager } from './risk/risk-manager';
import { TradeExecutor } from './trading/trade-executor';
import { AgentManager } from './engine/agent-manager';
import { startServer } from './api/server';
import { config } from './config';
import { createLogger } from './utils/logger';

const log = createLogger('Main');

async function main() {
  log.info('=== AgentPit Starting ===');
  log.info(`Mode: ${config.hyperliquid.isTestnet ? 'TESTNET' : 'MAINNET'}`);

  // --- Initialize Core Services ---

  const marketData = new MarketDataService();
  const indicators = new IndicatorEngine();
  const llm = new LLMRouter();
  const risk = new RiskManager();
  const executor = new TradeExecutor(true); // Mock mode

  // Connect to market data
  await marketData.connect();
  log.info('Market data connected');

  // Initialize trade executor
  await executor.initialize();

  // --- Initialize Agent Manager ---

  const manager = new AgentManager(marketData, indicators, llm, risk, executor);
  await manager.start();

  // Load any agents that were running before shutdown
  await manager.loadAgents();
  log.info(`Loaded ${manager.listAgents().length} agents from database`);

  // --- Start API Server ---

  const apiConfig = {
    port: parseInt(process.env.API_PORT || '3000', 10),
    host: process.env.API_HOST || '0.0.0.0',
    jwtSecret: process.env.JWT_SECRET || 'agentpit-dev-secret-change-me',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
  };

  const server = await startServer(manager, apiConfig);

  // --- Agent Event Logging ---

  manager.on('agent-event', (event) => {
    switch (event.type) {
      case 'decision':
        log.info(`[${event.agentId.substring(0, 8)}] Decision: ${event.decision.action} (${event.decision.confidence}%)`);
        break;
      case 'trade':
        log.info(`[${event.agentId.substring(0, 8)}] Trade: ${event.trade.action} ${event.trade.side} ${event.trade.symbol} @ $${event.trade.price}`);
        break;
      case 'risk_alert':
        log.warn(`[${event.agentId.substring(0, 8)}] Risk: ${event.alert}`);
        break;
      case 'error':
        log.error(`[${event.agentId.substring(0, 8)}] Error: ${event.error}`);
        break;
    }
  });

  log.info('=== AgentPit Running ===');
  log.info(`API: http://${apiConfig.host}:${apiConfig.port}`);
  log.info(`WebSocket: ws://${apiConfig.host}:${apiConfig.port}/api/v1/ws`);
  log.info('Press Ctrl+C to stop');

  // --- Graceful Shutdown ---

  const shutdown = async (signal: string) => {
    log.info(`Received ${signal}, shutting down...`);

    await server.close();
    log.info('API server closed');

    await manager.shutdown();
    marketData.disconnect();

    log.info('Goodbye 🐺');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Log stats every minute
  setInterval(async () => {
    const stats = await manager.getSchedulerStats();
    const agents = manager.listAgents();
    log.info(`[Status] ${agents.length} agents | scheduler: ${stats.active} active, ${stats.completed} completed, ${stats.failed} failed`);
  }, 60_000);
}

main().catch((err) => {
  log.error('Fatal error', err);
  process.exit(1);
});
