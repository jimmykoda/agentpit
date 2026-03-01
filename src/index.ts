// ============================================
// AgentPit - Main Entry Point
// Launch a single agent for testing/demo
// ============================================

import { MarketDataService } from './market/market-data';
import { IndicatorEngine } from './indicators/indicator-engine';
import { LLMRouter } from './llm/llm-router';
import { RiskManager } from './risk/risk-manager';
import { TradeExecutor } from './trading/trade-executor';
import { AgentLoop } from './engine/agent-loop';
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

  // Create a demo agent config
  const agentConfig: AgentConfig = {
    id: uuid(),
    name: 'AgentPit Demo',
    userId: 'demo-user',

    llmProvider: 'deepseek',
    llmModel: config.llm.deepseek.model,
    apiKey: config.llm.deepseek.apiKey,

    symbol: 'BTC',
    maxPositionSize: config.agent.defaultMaxPositionSize,
    maxLeverage: config.agent.defaultMaxLeverage,
    decisionIntervalMs: config.agent.defaultDecisionIntervalMs,

    strategy: {
      template: 'momentum',
      timeframes: ['5m', '15m', '1h', '4h'],
      indicators: ['rsi', 'macd', 'bollinger', 'ema', 'atr', 'stochRsi'],
    },

    risk: {
      maxDrawdownPercent: config.agent.defaultMaxDrawdown,
      maxDailyLossPercent: config.agent.defaultMaxDailyLoss,
      stopLossPercent: config.agent.defaultStopLoss,
      takeProfitPercent: config.agent.defaultTakeProfit,
      maxOpenPositions: config.agent.defaultMaxOpenPositions,
      cooldownAfterLossMs: config.agent.defaultCooldownMs,
    },

    status: 'idle',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Create and start the agent loop
  const agent = new AgentLoop(agentConfig, marketData, indicators, llm, risk, executor);

  // Listen to agent events
  agent.on('event', (event) => {
    switch (event.type) {
      case 'decision':
        log.info(`Decision: ${event.decision.action} | Confidence: ${event.decision.confidence}%`);
        break;
      case 'trade':
        log.info(`Trade: ${event.trade.action} ${event.trade.side} ${event.trade.size} ${event.trade.symbol} @ $${event.trade.price}`);
        if (event.trade.realizedPnl !== undefined) {
          log.info(`  PnL: $${event.trade.realizedPnl.toFixed(2)}`);
        }
        break;
      case 'risk_alert':
        log.warn(`Risk Alert: ${event.alert}`);
        break;
      case 'error':
        log.error(`Error: ${event.error}`);
        break;
      case 'status_change':
        log.info(`Status: ${event.from} -> ${event.to}`);
        break;
    }
  });

  // Start the agent
  await agent.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    log.info('Shutting down...');
    agent.stop();
    marketData.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log.info('Shutting down...');
    agent.stop();
    marketData.disconnect();
    process.exit(0);
  });

  log.info('=== AgentPit Engine Running ===');
  log.info(`Agent "${agentConfig.name}" is trading ${agentConfig.symbol} with ${agentConfig.strategy.template} strategy`);
  log.info('Press Ctrl+C to stop');
}

main().catch((err) => {
  log.error('Fatal error', err);
  process.exit(1);
});
