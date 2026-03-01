// ============================================
// AgentPit - Agent Manager
// Manages multiple agents concurrently
// ============================================

import { EventEmitter } from 'events';
import { AgentConfig, AgentStatus, AgentEvent } from '../types';
import { AgentLoop } from './agent-loop';
import { AgentScheduler } from './scheduler';
import { MarketDataService } from '../market/market-data';
import { IndicatorEngine } from '../indicators/indicator-engine';
import { LLMRouter } from '../llm/llm-router';
import { RiskManager } from '../risk/risk-manager';
import { TradeExecutor } from '../trading/trade-executor';
import {
  initSupabase,
  AgentRepository,
  TradeRepository,
  PositionRepository,
  AgentEventRepository,
} from '../db';
import { createLogger } from '../utils/logger';

const log = createLogger('AgentManager');

interface ManagedAgent {
  config: AgentConfig;
  loop: AgentLoop;
  cycleCount: number;
}

export class AgentManager extends EventEmitter {
  private agents: Map<string, ManagedAgent> = new Map();
  private scheduler: AgentScheduler;

  // Shared services
  private marketData: MarketDataService;
  private indicators: IndicatorEngine;
  private llm: LLMRouter;
  private risk: RiskManager;
  private executor: TradeExecutor;

  // Repositories
  private agentRepo: AgentRepository;
  private tradeRepo: TradeRepository;
  private positionRepo: PositionRepository;
  private eventRepo: AgentEventRepository;

  constructor(
    marketData: MarketDataService,
    indicators: IndicatorEngine,
    llm: LLMRouter,
    risk: RiskManager,
    executor: TradeExecutor,
  ) {
    super();
    this.marketData = marketData;
    this.indicators = indicators;
    this.llm = llm;
    this.risk = risk;
    this.executor = executor;

    // Initialize database
    initSupabase();
    this.agentRepo = new AgentRepository();
    this.tradeRepo = new TradeRepository();
    this.positionRepo = new PositionRepository();
    this.eventRepo = new AgentEventRepository();

    // Initialize scheduler
    this.scheduler = new AgentScheduler();
    this.scheduler.setJobHandler(this.handleAgentCycle.bind(this));

    log.info('AgentManager initialized');
  }

  /**
   * Start the manager (starts the scheduler worker)
   */
  async start(): Promise<void> {
    await this.scheduler.start();
    log.info('AgentManager started');
  }

  /**
   * Create a new agent
   */
  async createAgent(config: Omit<AgentConfig, 'createdAt' | 'updatedAt'>): Promise<AgentConfig> {
    // Save to database
    const savedConfig = await this.agentRepo.create(config);

    log.info(`Agent created: ${savedConfig.id} (${savedConfig.name})`);
    return savedConfig;
  }

  /**
   * Start an agent (load from DB if needed)
   */
  async startAgent(agentId: string): Promise<void> {
    // Check if already running
    if (this.agents.has(agentId)) {
      log.warn(`Agent ${agentId} is already running`);
      return;
    }

    // Load config from DB
    const config = await this.agentRepo.getById(agentId);
    if (!config) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Create AgentLoop
    const loop = new AgentLoop(
      config,
      this.marketData,
      this.indicators,
      this.llm,
      this.risk,
      this.executor,
    );

    // Listen to agent events and persist them
    loop.on('event', async (event: AgentEvent) => {
      try {
        // Log to database
        await this.eventRepo.log(event);

        // If it's a trade, also log to trades table
        if (event.type === 'trade') {
          await this.tradeRepo.create(event.trade);

          // Update position tracking
          if (event.trade.action === 'open') {
            const position = {
              id: event.trade.id,
              agentId: event.trade.agentId,
              symbol: event.trade.symbol,
              side: event.trade.side,
              size: event.trade.size,
              entryPrice: event.trade.price,
              leverage: event.trade.leverage,
              stopLoss: event.trade.llmDecision.stopLoss,
              takeProfit: event.trade.llmDecision.takeProfit,
              unrealizedPnl: 0,
            };
            await this.positionRepo.create(position);
          } else if (event.trade.action === 'close') {
            const openPos = await this.positionRepo.getOpenPosition(
              event.trade.agentId,
              event.trade.symbol,
              event.trade.side,
            );
            if (openPos) {
              await this.positionRepo.close(openPos.id);
            }
          }
        }

        // If it's a status change, update DB
        if (event.type === 'status_change') {
          await this.agentRepo.updateStatus(event.agentId, event.to);
        }

        // Emit to manager listeners
        this.emit('agent-event', event);
      } catch (err) {
        log.error('Failed to persist event', err);
      }
    });

    // Store the managed agent
    const managed: ManagedAgent = {
      config,
      loop,
      cycleCount: 0,
    };
    this.agents.set(agentId, managed);

    // Subscribe to market data
    this.marketData.subscribe(config.symbol);

    // Start the loop (runs first cycle, then uses scheduler)
    await loop.start();

    // Schedule repeating cycles via BullMQ
    await this.scheduler.scheduleDecision(
      agentId,
      config.name,
      managed.cycleCount,
      config.decisionIntervalMs,
      config.llmProvider,
    );

    // Update status in DB
    await this.agentRepo.updateStatus(agentId, 'running');

    log.info(`Agent ${config.name} started`);
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string): Promise<void> {
    const managed = this.agents.get(agentId);
    if (!managed) {
      log.warn(`Agent ${agentId} is not running`);
      return;
    }

    // Cancel scheduled jobs
    await this.scheduler.cancelSchedule(agentId);

    // Stop the loop
    managed.loop.stop();

    // Remove from active agents
    this.agents.delete(agentId);

    // Update status in DB
    await this.agentRepo.updateStatus(agentId, 'stopped');

    log.info(`Agent ${managed.config.name} stopped`);
  }

  /**
   * Pause an agent
   */
  async pauseAgent(agentId: string): Promise<void> {
    const managed = this.agents.get(agentId);
    if (!managed) {
      log.warn(`Agent ${agentId} is not running`);
      return;
    }

    // Pause the loop
    managed.loop.pause();

    // Pause scheduled jobs
    await this.scheduler.pauseAgent(agentId);

    // Update status in DB
    await this.agentRepo.updateStatus(agentId, 'paused');

    log.info(`Agent ${managed.config.name} paused`);
  }

  /**
   * Remove an agent (stops it and deletes from DB)
   */
  async removeAgent(agentId: string): Promise<void> {
    // Stop if running
    if (this.agents.has(agentId)) {
      await this.stopAgent(agentId);
    }

    // Delete from database (cascades to trades, positions, events)
    await this.agentRepo.delete(agentId);

    log.info(`Agent ${agentId} removed`);
  }

  /**
   * Get an agent's current state
   */
  getAgent(agentId: string): ManagedAgent | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * List all active agents
   */
  listAgents(): ManagedAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Load and start all agents from database with status 'running'
   */
  async loadAgents(): Promise<void> {
    const runningAgents = await this.agentRepo.listByStatus('running');

    log.info(`Loading ${runningAgents.length} agents from database`);

    for (const config of runningAgents) {
      try {
        await this.startAgent(config.id);
      } catch (err) {
        log.error(`Failed to start agent ${config.id}`, err);
      }
    }
  }

  /**
   * Get scheduler stats
   */
  async getSchedulerStats() {
    return await this.scheduler.getStats();
  }

  /**
   * Graceful shutdown: stop all agents
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down AgentManager...');

    const agentIds = Array.from(this.agents.keys());
    for (const id of agentIds) {
      try {
        await this.stopAgent(id);
      } catch (err) {
        log.error(`Failed to stop agent ${id}`, err);
      }
    }

    await this.scheduler.shutdown();
    log.info('AgentManager shut down');
  }

  // --- Private Methods ---

  /**
   * Handle a scheduled agent decision cycle (called by scheduler)
   */
  private async handleAgentCycle(agentId: string): Promise<void> {
    const managed = this.agents.get(agentId);
    if (!managed) {
      log.warn(`Agent ${agentId} not found in active agents`);
      return;
    }

    // AgentLoop already handles the cycle internally
    // We just trigger it here via the runCycle method
    // Since AgentLoop uses setInterval internally, we'll modify the flow:
    // Instead of setInterval in AgentLoop, we'll call a public runCycle method

    // For now, let's assume we've modified AgentLoop to expose runCycle()
    // (We'll handle this in the next step if needed)

    // Increment cycle count
    managed.cycleCount++;

    log.debug(`Scheduler triggered cycle #${managed.cycleCount} for agent ${managed.config.name}`);
  }
}
