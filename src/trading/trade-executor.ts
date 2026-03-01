// ============================================
// AgentPit - Trade Executor
// Executes trades on Hyperliquid
// ============================================

// @ts-ignore - SDK types may not perfectly match, using any for flexibility
import { Hyperliquid } from 'hyperliquid';
import { LLMDecision, Position, Trade } from '../types';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

const log = createLogger('TradeExecutor');

export class TradeExecutor {
  private sdk: Hyperliquid | null = null;
  private mockMode: boolean;

  constructor(mockMode: boolean = true) {
    this.mockMode = mockMode;
  }

  /**
   * Initialize the Hyperliquid SDK
   */
  async initialize(privateKey?: string): Promise<void> {
    if (this.mockMode) {
      log.info('Trade executor running in MOCK mode');
      return;
    }

    const key = privateKey || config.hyperliquid.privateKey;
    if (!key) {
      throw new Error('Hyperliquid private key required for live trading');
    }

    this.sdk = new Hyperliquid({
      privateKey: key,
      testnet: config.hyperliquid.isTestnet,
    } as any);

    await (this.sdk as any).connect();
    log.info(`Connected to Hyperliquid (${config.hyperliquid.isTestnet ? 'testnet' : 'MAINNET'})`);
  }

  /**
   * Execute a trade based on LLM decision
   */
  async execute(
    decision: LLMDecision,
    currentPrice: number,
    accountBalance: number,
  ): Promise<Trade | null> {
    if (decision.action === 'hold') {
      log.info('Decision: HOLD — no trade executed');
      return null;
    }

    const size = this.calculateSize(decision, currentPrice, accountBalance);
    const leverage = decision.leverage || 1;

    log.info(`Executing: ${decision.action} ${decision.pair} | Size: ${size} | Leverage: ${leverage}x | Price: $${currentPrice}`);

    if (this.mockMode) {
      return this.mockExecute(decision, currentPrice, size, leverage);
    }

    return this.liveExecute(decision, currentPrice, size, leverage);
  }

  /**
   * Get current positions from Hyperliquid
   */
  async getPositions(walletAddress?: string): Promise<Position[]> {
    if (this.mockMode) {
      return []; // Mock mode tracks positions in-memory via agent loop
    }

    if (!this.sdk) throw new Error('SDK not initialized');

    try {
      const state = await this.sdk.info.perpetuals.getClearinghouseState(walletAddress || '');
      const positions: Position[] = [];

      for (const pos of (state as any).assetPositions || []) {
        const position = pos.position;
        if (parseFloat(position.szi) !== 0) {
          positions.push({
            id: uuid(),
            agentId: '',
            symbol: position.coin,
            side: parseFloat(position.szi) > 0 ? 'long' : 'short',
            size: Math.abs(parseFloat(position.szi)),
            entryPrice: parseFloat(position.entryPx),
            leverage: parseFloat(position.leverage?.value || '1'),
            unrealizedPnl: parseFloat(position.unrealizedPnl),
            openedAt: Date.now(),
          });
        }
      }

      return positions;
    } catch (err: any) {
      log.error('Failed to fetch positions', err.message);
      return [];
    }
  }

  /**
   * Get account balance
   */
  async getBalance(walletAddress?: string): Promise<number> {
    if (this.mockMode) {
      return 10000; // Mock $10k balance
    }

    if (!this.sdk) throw new Error('SDK not initialized');

    try {
      const state = await this.sdk.info.perpetuals.getClearinghouseState(walletAddress || '');
      return parseFloat((state as any).marginSummary?.accountValue || '0');
    } catch (err: any) {
      log.error('Failed to fetch balance', err.message);
      return 0;
    }
  }

  // --- Private Methods ---

  private calculateSize(decision: LLMDecision, price: number, balance: number): number {
    const sizePercent = (decision.positionSizePercent || 10) / 100;
    const notionalValue = balance * sizePercent;
    const size = notionalValue / price;
    return Math.round(size * 10000) / 10000; // Round to 4 decimals
  }

  private async mockExecute(
    decision: LLMDecision,
    price: number,
    size: number,
    leverage: number,
  ): Promise<Trade> {
    // Simulate a small delay
    await new Promise(r => setTimeout(r, 100));

    const trade: Trade = {
      id: uuid(),
      agentId: '',
      symbol: decision.pair,
      side: decision.side || (decision.action === 'open_long' ? 'long' : 'short'),
      action: decision.action === 'close' || decision.action === 'reduce' ? 'close' : 'open',
      size,
      price,
      leverage,
      fee: size * price * 0.0006, // 0.06% taker fee
      reasoning: decision.reasoning,
      llmDecision: decision,
      timestamp: Date.now(),
    };

    log.info(`[MOCK] Trade executed: ${trade.action} ${trade.side} ${trade.size} ${trade.symbol} @ $${trade.price}`);
    return trade;
  }

  private async liveExecute(
    decision: LLMDecision,
    price: number,
    size: number,
    leverage: number,
  ): Promise<Trade | null> {
    if (!this.sdk) throw new Error('SDK not initialized');

    try {
      const isBuy = decision.action === 'open_long' || (decision.action === 'close' && decision.side === 'short');

      const sdk = this.sdk as any;

      // Set leverage first
      await sdk.exchange.updateLeverage({
        coin: decision.pair,
        leverageMode: 'cross',
        leverage: leverage,
      });

      // Place market order
      const result = await sdk.exchange.placeOrder({
        coin: decision.pair,
        isBuy,
        sz: size,
        limitPx: isBuy ? price * 1.005 : price * 0.995,
        orderType: { limit: { tif: 'Ioc' } },
        reduceOnly: decision.action === 'close' || decision.action === 'reduce',
      });

      log.info('Order result', result);

      const trade: Trade = {
        id: uuid(),
        agentId: '',
        symbol: decision.pair,
        side: decision.side || (isBuy ? 'long' : 'short'),
        action: decision.action === 'close' || decision.action === 'reduce' ? 'close' : 'open',
        size,
        price,
        leverage,
        fee: size * price * 0.0006,
        reasoning: decision.reasoning,
        llmDecision: decision,
        timestamp: Date.now(),
      };

      // Place stop loss if provided
      if (decision.stopLoss) {
        await sdk.exchange.placeOrder({
          coin: decision.pair,
          isBuy: !isBuy,
          sz: size,
          limitPx: decision.stopLoss,
          orderType: {
            trigger: {
              triggerPx: decision.stopLoss.toString(),
              isMarket: true,
              tpsl: 'sl',
            },
          },
          reduceOnly: true,
        });
        log.info(`Stop loss placed at $${decision.stopLoss}`);
      }

      // Place take profit if provided
      if (decision.takeProfit) {
        await sdk.exchange.placeOrder({
          coin: decision.pair,
          isBuy: !isBuy,
          sz: size,
          limitPx: decision.takeProfit,
          orderType: {
            trigger: {
              triggerPx: decision.takeProfit.toString(),
              isMarket: true,
              tpsl: 'tp',
            },
          },
          reduceOnly: true,
        });
        log.info(`Take profit placed at $${decision.takeProfit}`);
      }

      return trade;
    } catch (err: any) {
      log.error('Trade execution failed', err.message);
      return null;
    }
  }
}
