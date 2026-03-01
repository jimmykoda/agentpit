// ============================================
// AgentPit - Risk Manager
// Enforces risk rules and prevents bad trades
// ============================================

import { AgentConfig, LLMDecision, Position, Trade, AgentEvent } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('RiskManager');

export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
  adjustedDecision?: LLMDecision;
}

export class RiskManager {
  private dailyPnL: Map<string, number> = new Map(); // agentId -> daily PnL
  private peakBalance: Map<string, number> = new Map(); // agentId -> peak balance
  private lastLossTime: Map<string, number> = new Map(); // agentId -> timestamp of last loss

  /**
   * Check if a trade decision passes risk rules
   */
  check(
    decision: LLMDecision,
    agentConfig: AgentConfig,
    currentPosition: Position | null,
    accountBalance: number,
  ): RiskCheckResult {
    const { risk } = agentConfig;

    const action = decision.action as string;

    // 1. Hold decisions always pass
    if (action === 'hold') {
      return { approved: true };
    }

    // 2. Check cooldown after loss
    const lastLoss = this.lastLossTime.get(agentConfig.id);
    if (lastLoss && Date.now() - lastLoss < risk.cooldownAfterLossMs) {
      const remaining = Math.ceil((risk.cooldownAfterLossMs - (Date.now() - lastLoss)) / 1000);
      return {
        approved: false,
        reason: `Cooldown active: ${remaining}s remaining after last loss`,
      };
    }

    // 3. Check daily loss limit
    const dailyPnl = this.dailyPnL.get(agentConfig.id) || 0;
    const dailyLossLimit = accountBalance * (risk.maxDailyLossPercent / 100);
    if (dailyPnl < -dailyLossLimit) {
      return {
        approved: false,
        reason: `Daily loss limit hit: $${dailyPnl.toFixed(2)} (limit: -$${dailyLossLimit.toFixed(2)})`,
      };
    }

    // 4. Check max drawdown
    const peak = this.peakBalance.get(agentConfig.id) || accountBalance;
    const drawdown = ((peak - accountBalance) / peak) * 100;
    if (drawdown >= risk.maxDrawdownPercent) {
      return {
        approved: false,
        reason: `Max drawdown reached: ${drawdown.toFixed(2)}% (limit: ${risk.maxDrawdownPercent}%)`,
      };
    }

    // 5. Close/reduce decisions always pass risk (we want to allow de-risking)
    if (action === 'close' || action === 'reduce') {
      return { approved: true };
    }

    // 6. Check if opening a new position when max positions reached
    if (currentPosition && (action === 'open_long' || action === 'open_short')) {
      // Already have a position — check if it's in the same direction
      if (
        (currentPosition.side === 'long' && action === 'open_long') ||
        (currentPosition.side === 'short' && action === 'open_short')
      ) {
        return {
          approved: false,
          reason: `Already have an open ${currentPosition.side} position`,
        };
      }
    }

    // 7. Validate and cap leverage
    const adjustedDecision = { ...decision };
    if (adjustedDecision.leverage && adjustedDecision.leverage > agentConfig.maxLeverage) {
      log.warn(`Capping leverage from ${adjustedDecision.leverage}x to ${agentConfig.maxLeverage}x`);
      adjustedDecision.leverage = agentConfig.maxLeverage;
    }

    // 8. Validate position size
    if (adjustedDecision.positionSizePercent && adjustedDecision.positionSizePercent > 100) {
      adjustedDecision.positionSizePercent = 100;
    }

    const positionValue = accountBalance * ((adjustedDecision.positionSizePercent || 10) / 100);
    if (positionValue > agentConfig.maxPositionSize) {
      adjustedDecision.positionSizePercent = (agentConfig.maxPositionSize / accountBalance) * 100;
      log.warn(`Capping position size to $${agentConfig.maxPositionSize}`);
    }

    // 9. Ensure stop loss is set
    if (!adjustedDecision.stopLoss && decision.action !== 'hold') {
      log.warn('No stop loss provided — will use default');
    }

    // 10. Confidence threshold — reject low confidence trades
    if (adjustedDecision.confidence < 30) {
      return {
        approved: false,
        reason: `Confidence too low: ${adjustedDecision.confidence}% (minimum: 30%)`,
      };
    }

    return { approved: true, adjustedDecision };
  }

  /**
   * Record a completed trade for tracking
   */
  recordTrade(agentId: string, trade: Trade, accountBalance: number): void {
    // Update daily PnL
    if (trade.realizedPnl !== undefined) {
      const current = this.dailyPnL.get(agentId) || 0;
      this.dailyPnL.set(agentId, current + trade.realizedPnl);

      if (trade.realizedPnl < 0) {
        this.lastLossTime.set(agentId, Date.now());
      }
    }

    // Update peak balance
    const currentPeak = this.peakBalance.get(agentId) || 0;
    if (accountBalance > currentPeak) {
      this.peakBalance.set(agentId, accountBalance);
    }
  }

  /**
   * Reset daily tracking (call at start of each day)
   */
  resetDaily(): void {
    this.dailyPnL.clear();
    log.info('Daily PnL tracking reset');
  }

  /**
   * Get current risk stats for an agent
   */
  getStats(agentId: string, accountBalance: number) {
    const peak = this.peakBalance.get(agentId) || accountBalance;
    const drawdown = ((peak - accountBalance) / peak) * 100;

    return {
      dailyPnL: this.dailyPnL.get(agentId) || 0,
      peakBalance: peak,
      currentDrawdown: drawdown,
      lastLossTime: this.lastLossTime.get(agentId) || null,
    };
  }
}
