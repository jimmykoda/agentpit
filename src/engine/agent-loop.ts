// ============================================
// AgentPit - Agent Loop
// The core decision cycle: observe → analyze →
// decide → execute → repeat
// ============================================

import { EventEmitter } from 'events';
import { AgentConfig, AgentEvent, MarketContext, Position, Trade, Timeframe } from '../types';
import { MarketDataService } from '../market/market-data';
import { IndicatorEngine } from '../indicators/indicator-engine';
import { LLMRouter } from '../llm/llm-router';
import { buildSystemPrompt, buildMarketPrompt } from '../llm/prompt-builder';
import { RiskManager } from '../risk/risk-manager';
import { TradeExecutor } from '../trading/trade-executor';
import { createLogger } from '../utils/logger';

const log = createLogger('AgentLoop');

export class AgentLoop extends EventEmitter {
  private config: AgentConfig;
  private marketData: MarketDataService;
  private indicators: IndicatorEngine;
  private llm: LLMRouter;
  private risk: RiskManager;
  private executor: TradeExecutor;

  private intervalHandle: NodeJS.Timeout | null = null;
  private currentPosition: Position | null = null;
  private trades: Trade[] = [];
  private accountBalance: number = 10000;
  private cycleCount: number = 0;

  constructor(
    agentConfig: AgentConfig,
    marketData: MarketDataService,
    indicators: IndicatorEngine,
    llm: LLMRouter,
    risk: RiskManager,
    executor: TradeExecutor,
  ) {
    super();
    this.config = agentConfig;
    this.marketData = marketData;
    this.indicators = indicators;
    this.llm = llm;
    this.risk = risk;
    this.executor = executor;
  }

  /**
   * Start the agent's decision loop
   */
  async start(): Promise<void> {
    log.info(`Starting agent "${this.config.name}" [${this.config.id}]`);
    log.info(`Strategy: ${this.config.strategy.template} | Symbol: ${this.config.symbol} | Interval: ${this.config.decisionIntervalMs}ms`);

    // Subscribe to market data
    this.marketData.subscribe(this.config.symbol);

    // Update status
    this.updateStatus('running');

    // Run first cycle immediately
    await this.runCycle();

    // Then run on interval
    this.intervalHandle = setInterval(() => {
      this.runCycle().catch(err => {
        log.error('Cycle error', err);
        this.emitEvent({
          type: 'error',
          agentId: this.config.id,
          error: err.message,
          timestamp: Date.now(),
        });
      });
    }, this.config.decisionIntervalMs);

    log.info(`Agent "${this.config.name}" is now running`);
  }

  /**
   * Stop the agent
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.updateStatus('stopped');
    log.info(`Agent "${this.config.name}" stopped`);
  }

  /**
   * Pause the agent (keeps subscriptions)
   */
  pause(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.updateStatus('paused');
    log.info(`Agent "${this.config.name}" paused`);
  }

  /**
   * Get agent state summary
   */
  getState() {
    return {
      config: this.config,
      currentPosition: this.currentPosition,
      recentTrades: this.trades.slice(-20),
      accountBalance: this.accountBalance,
      cycleCount: this.cycleCount,
      riskStats: this.risk.getStats(this.config.id, this.accountBalance),
    };
  }

  // --- Core Decision Cycle ---

  private async runCycle(): Promise<void> {
    this.cycleCount++;
    const cycleStart = Date.now();
    log.info(`--- Cycle #${this.cycleCount} for "${this.config.name}" ---`);

    try {
      // Step 1: Gather market context
      const context = await this.buildMarketContext();
      if (!context) {
        log.warn('Could not build market context — skipping cycle');
        return;
      }

      // Step 2: Get LLM decision
      const systemPrompt = buildSystemPrompt(this.config);
      const marketPrompt = buildMarketPrompt(context);

      const decision = await this.llm.getDecision({
        provider: this.config.llmProvider,
        model: this.config.llmModel,
        apiKey: this.config.apiKey,
        systemPrompt,
        userPrompt: marketPrompt,
      });

      decision.pair = this.config.symbol;

      log.info(`Decision: ${decision.action} | Confidence: ${decision.confidence}% | Reasoning: ${decision.reasoning.substring(0, 100)}`);

      this.emitEvent({
        type: 'decision',
        agentId: this.config.id,
        decision,
        timestamp: Date.now(),
      });

      // Step 3: Risk check
      const riskCheck = this.risk.check(
        decision,
        this.config,
        this.currentPosition,
        this.accountBalance,
      );

      if (!riskCheck.approved) {
        log.warn(`Risk check REJECTED: ${riskCheck.reason}`);
        this.emitEvent({
          type: 'risk_alert',
          agentId: this.config.id,
          alert: riskCheck.reason!,
          timestamp: Date.now(),
        });
        return;
      }

      const finalDecision = riskCheck.adjustedDecision || decision;

      // Step 4: Execute trade
      const trade = await this.executor.execute(
        finalDecision,
        context.currentPrice,
        this.accountBalance,
      );

      if (trade) {
        trade.agentId = this.config.id;
        this.trades.push(trade);

        // Update position tracking (simplified for mock mode)
        if (trade.action === 'open') {
          this.currentPosition = {
            id: trade.id,
            agentId: this.config.id,
            symbol: trade.symbol,
            side: trade.side,
            size: trade.size,
            entryPrice: trade.price,
            leverage: trade.leverage,
            stopLoss: finalDecision.stopLoss,
            takeProfit: finalDecision.takeProfit,
            unrealizedPnl: 0,
            openedAt: trade.timestamp,
          };
        } else if (trade.action === 'close') {
          // Calculate PnL
          if (this.currentPosition) {
            const priceDiff = trade.price - this.currentPosition.entryPrice;
            const direction = this.currentPosition.side === 'long' ? 1 : -1;
            trade.realizedPnl = priceDiff * direction * this.currentPosition.size * this.currentPosition.leverage - trade.fee;
            this.accountBalance += trade.realizedPnl;

            log.info(`Closed position: PnL = $${trade.realizedPnl.toFixed(2)}`);
            this.risk.recordTrade(this.config.id, trade, this.accountBalance);
          }
          this.currentPosition = null;
        }

        this.emitEvent({
          type: 'trade',
          agentId: this.config.id,
          trade,
          timestamp: Date.now(),
        });
      }

      // Update unrealized PnL on current position
      if (this.currentPosition) {
        const priceDiff = context.currentPrice - this.currentPosition.entryPrice;
        const direction = this.currentPosition.side === 'long' ? 1 : -1;
        this.currentPosition.unrealizedPnl = priceDiff * direction * this.currentPosition.size * this.currentPosition.leverage;
      }

      const elapsed = Date.now() - cycleStart;
      log.info(`Cycle #${this.cycleCount} completed in ${elapsed}ms | Balance: $${this.accountBalance.toFixed(2)}`);

    } catch (err: any) {
      log.error(`Cycle #${this.cycleCount} failed: ${err.message}`);
      this.emitEvent({
        type: 'error',
        agentId: this.config.id,
        error: err.message,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Build complete market context for LLM
   */
  private async buildMarketContext(): Promise<MarketContext | null> {
    const symbol = this.config.symbol;
    const ticker = this.marketData.getTicker(symbol);
    const currentPrice = this.marketData.getCurrentPrice(symbol);
    const orderBook = this.marketData.getOrderBook(symbol);

    // Fetch candles for each configured timeframe
    const indicatorsByTimeframe: Record<string, any> = {};
    let recentCandles: any[] = [];

    for (const tf of this.config.strategy.timeframes) {
      const candles = await this.marketData.getCandles(symbol, tf, 200);
      if (candles.length > 0) {
        indicatorsByTimeframe[tf] = this.indicators.calculate(candles);
        if (tf === this.config.strategy.timeframes[0]) {
          recentCandles = candles;
        }
      }
    }

    // If we don't have price data yet, skip
    if (!currentPrice || !ticker) {
      log.warn(`No price data for ${symbol} yet`);
      return null;
    }

    const ob = orderBook || { bids: [], asks: [], timestamp: Date.now() };
    const topBids = ob.bids.slice(0, 10);
    const topAsks = ob.asks.slice(0, 10);
    const spread = topAsks.length > 0 && topBids.length > 0
      ? topAsks[0][0] - topBids[0][0]
      : 0;

    return {
      symbol,
      currentPrice,
      ticker,
      indicators: indicatorsByTimeframe as any,
      recentCandles,
      orderBook: {
        topBids,
        topAsks,
        spread,
        spreadPercent: currentPrice > 0 ? (spread / currentPrice) * 100 : 0,
      },
      currentPosition: this.currentPosition,
      recentTrades: this.trades.slice(-10),
      accountBalance: this.accountBalance,
      timestamp: Date.now(),
    };
  }

  private updateStatus(status: AgentConfig['status']): void {
    const from = this.config.status;
    this.config.status = status;
    this.config.updatedAt = Date.now();
    this.emitEvent({
      type: 'status_change',
      agentId: this.config.id,
      from,
      to: status,
      timestamp: Date.now(),
    });
  }

  private emitEvent(event: AgentEvent): void {
    this.emit('event', event);
  }
}
