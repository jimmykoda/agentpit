// ============================================
// AgentPit - Main Entry Point
// Multi-agent trading system with database persistence
// ============================================

import { MarketDataService } from './market/market-data';
import { IndicatorEngine } from './indicators/indicator-engine';
import { LLMRouter } from './llm/llm-router';
import { RiskManager } from './risk/risk-manager';
import { TradeExecutor } from './trading/trade-executor';
import { AgentManager } from './engine/agent-manager';
import { AgentConfig } from './types';
import { config } from './config';
import { createLogger } from './utils/logger';
import { v4 as uuid } from 'uuid';

const log = createLogger('Main');

async function main() {
  log.info('=== AgentPit Engine Starting ===');
  log.info(`Mode: ${config.hyperliquid.isTestnet ? 'TESTNET' : 'MAINNET'}`);

  // Initialize services
  const marketData = new MarketDataService();
  const indicators = new IndicatorEngine();
  const llm = new LLMRouter();
  const risk = new RiskManager();
  const executor = new TradeExecutor(true); // Mock mode for now

  // Connect to market data
  await marketData.connect();
  log.info('Market data connected');

  // Initialize trade executor
  await executor.initialize();

  // Create Agent Manager
  const manager = new AgentManager(marketData, indicators, llm, risk, executor);

  // Start the manager (starts scheduler worker)
  await manager.start();

  // Load any agents from database that were running
  await manager.loadAgents();

  // --- Demo: Create and start multiple agents ---

  log.info('--- Creating demo agents ---');

  // Agent 1: BTC Momentum Trader
  const btcAgent: Omit<AgentConfig, 'createdAt' | 'updatedAt'> = {
    id: uuid(),
    name: 'BTC Momentum Bot',
    userId: 'demo-user',

    llmProvider: 'deepseek',
    llmModel: config.llm.deepseek.model,
    apiKey: config.llm.deepseek.apiKey,

    symbol: 'BTC',
    maxPositionSize: 2000,
    maxLeverage: 10,
    decisionIntervalMs: 5 * 60 * 1000, // 5 minutes

    strategy: {
      template: 'momentum',
      timeframes: ['5m', '15m', '1h'],
      indicators: ['rsi', 'macd', 'ema', 'atr'],
    },

    risk: {
      maxDrawdownPercent: 15,
      maxDailyLossPercent: 10,
      stopLossPercent: 4,
      takeProfitPercent: 8,
      maxOpenPositions: 2,
      cooldownAfterLossMs: 2 * 60 * 1000,
    },

    status: 'idle',
  };

  // Agent 2: ETH Scalper
  const ethAgent: Omit<AgentConfig, 'createdAt' | 'updatedAt'> = {
    id: uuid(),
    name: 'ETH Scalper',
    userId: 'demo-user',

    llmProvider: 'deepseek',
    llmModel: config.llm.deepseek.model,
    apiKey: config.llm.deepseek.apiKey,

    symbol: 'ETH',
    maxPositionSize: 1500,
    maxLeverage: 15,
    decisionIntervalMs: 2 * 60 * 1000, // 2 minutes

    strategy: {
      template: 'scalping',
      timeframes: ['1m', '5m', '15m'],
      indicators: ['rsi', 'bollinger', 'stochRsi', 'volume'],
    },

    risk: {
      maxDrawdownPercent: 10,
      maxDailyLossPercent: 8,
      stopLossPercent: 2,
      takeProfitPercent: 4,
      maxOpenPositions: 3,
      cooldownAfterLossMs: 1 * 60 * 1000,
    },

    status: 'idle',
  };

  // Agent 3: SOL Mean Reversion
  const solAgent: Omit<AgentConfig, 'createdAt' | 'updatedAt'> = {
    id: uuid(),
    name: 'SOL Mean Reversion',
    userId: 'demo-user',

    llmProvider: 'deepseek',
    llmModel: config.llm.deepseek.model,
    apiKey: config.llm.deepseek.apiKey,

    symbol: 'SOL',
    maxPositionSize: 1000,
    maxLeverage: 5,
    decisionIntervalMs: 10 * 60 * 1000, // 10 minutes

    strategy: {
      template: 'mean_reversion',
      timeframes: ['15m', '1h', '4h'],
      indicators: ['rsi', 'bollinger', 'sma', 'atr'],
    },

    risk: {
      maxDrawdownPercent: 20,
      maxDailyLossPercent: 12,
      stopLossPercent: 6,
      takeProfitPercent: 12,
      maxOpenPositions: 1,
      cooldownAfterLossMs: 5 * 60 * 1000,
    },

    status: 'idle',
  };

  // Create agents in database
  const btcConfig = await manager.createAgent(btcAgent);
  const ethConfig = await manager.createAgent(ethAgent);
  const solConfig = await manager.createAgent(solAgent);

  log.info('Demo agents created in database');

  // Start all agents
  await manager.startAgent(btcConfig.id);
  await manager.startAgent(ethConfig.id);
  await manager.startAgent(solConfig.id);

  log.info('=== AgentPit Engine Running ===');
  log.info(`Managing ${manager.listAgents().length} active agents`);
  log.info('Press Ctrl+C to stop');

  // Listen to agent events
  manager.on('agent-event', (event) => {
    switch (event.type) {
      case 'decision':
        log.info(`[${event.agentId.substring(0, 8)}] Decision: ${event.decision.action} (confidence: ${event.decision.confidence}%)`);
        break;
      case 'trade':
        log.info(`[${event.agentId.substring(0, 8)}] Trade: ${event.trade.action} ${event.trade.side} ${event.trade.symbol} @ $${event.trade.price}`);
        if (event.trade.realizedPnl !== undefined) {
          log.info(`  PnL: $${event.trade.realizedPnl.toFixed(2)}`);
        }
        break;
      case 'risk_alert':
        log.warn(`[${event.agentId.substring(0, 8)}] Risk Alert: ${event.alert}`);
        break;
      case 'error':
        log.error(`[${event.agentId.substring(0, 8)}] Error: ${event.error}`);
        break;
      case 'status_change':
        log.info(`[${event.agentId.substring(0, 8)}] Status: ${event.from} -> ${event.to}`);
        break;
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    log.info('Shutting down...');
    await manager.shutdown();
    marketData.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    log.info('Shutting down...');
    await manager.shutdown();
    marketData.disconnect();
    process.exit(0);
  });

  // Log scheduler stats every minute
  setInterval(async () => {
    const stats = await manager.getSchedulerStats();
    log.info(`Scheduler: ${stats.active} active | ${stats.waiting} waiting | ${stats.completed} completed | ${stats.failed} failed`);
  }, 60 * 1000);
}

main().catch((err) => {
  log.error('Fatal error', err);
  process.exit(1);
});
