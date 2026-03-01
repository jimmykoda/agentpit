// ============================================
// AgentPit - ICT / Smart Money Concepts Engine
// Implements Inner Circle Trader methodology
// ============================================

import { OHLCV, ICTAnalysis, OrderBlock, FairValueGap, BreakOfStructure, ChangeOfCharacter, LiquidityZone, KillZone, PremiumDiscount } from '../types';
import { createLogger } from '../utils/logger';
import { ATR } from 'technicalindicators';

const log = createLogger('ICTEngine');

export class ICTEngine {

  /**
   * Calculate ICT analysis from candle data
   */
  calculate(candles: OHLCV[], currentTime?: number): ICTAnalysis {
    if (candles.length < 50) {
      log.warn(`Only ${candles.length} candles available for ICT analysis`);
    }

    const currentPrice = candles[candles.length - 1].close;
    const atr = this.calculateATR(candles);

    return {
      orderBlocks: this.findOrderBlocks(candles, atr),
      fairValueGaps: this.findFairValueGaps(candles),
      breakOfStructure: this.findBreakOfStructure(candles),
      changeOfCharacter: this.findChangeOfCharacter(candles),
      liquidityZones: this.findLiquidityZones(candles),
      killZone: this.checkKillZone(currentTime || candles[candles.length - 1].timestamp),
      premiumDiscount: this.calculatePremiumDiscount(candles),
      marketStructure: this.determineMarketStructure(candles),
    };
  }

  /**
   * Find order blocks: last opposite candle before strong displacement
   */
  private findOrderBlocks(candles: OHLCV[], atr: number): OrderBlock[] {
    const orderBlocks: OrderBlock[] = [];
    const displacementThreshold = atr * 1.5;
    const lookback = Math.min(100, candles.length);

    for (let i = candles.length - lookback; i < candles.length - 1; i++) {
      const current = candles[i];
      const next = candles[i + 1];
      
      const currentRange = Math.abs(current.close - current.open);
      const nextRange = Math.abs(next.close - next.open);

      // Bearish Order Block: bullish candle before strong bearish move
      if (current.close > current.open && next.close < next.open && nextRange >= displacementThreshold) {
        const mitigated = this.isOrderBlockMitigated(candles, i, 'bearish');
        orderBlocks.push({
          type: 'bearish',
          high: current.high,
          low: current.low,
          index: i,
          timestamp: current.timestamp,
          mitigated,
          strength: nextRange / atr,
        });
      }

      // Bullish Order Block: bearish candle before strong bullish move
      if (current.close < current.open && next.close > next.open && nextRange >= displacementThreshold) {
        const mitigated = this.isOrderBlockMitigated(candles, i, 'bullish');
        orderBlocks.push({
          type: 'bullish',
          high: current.high,
          low: current.low,
          index: i,
          timestamp: current.timestamp,
          mitigated,
          strength: nextRange / atr,
        });
      }
    }

    return orderBlocks.slice(-10); // Keep last 10 order blocks
  }

  /**
   * Check if order block has been mitigated (price returned to it)
   */
  private isOrderBlockMitigated(candles: OHLCV[], obIndex: number, type: 'bullish' | 'bearish'): boolean {
    const ob = candles[obIndex];
    
    for (let i = obIndex + 1; i < candles.length; i++) {
      if (type === 'bullish' && candles[i].low <= ob.high) {
        return true;
      }
      if (type === 'bearish' && candles[i].high >= ob.low) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Find Fair Value Gaps: 3-candle pattern with price gap
   */
  private findFairValueGaps(candles: OHLCV[]): FairValueGap[] {
    const fvgs: FairValueGap[] = [];
    const lookback = Math.min(100, candles.length);

    for (let i = candles.length - lookback; i < candles.length - 2; i++) {
      const c1 = candles[i];
      const c2 = candles[i + 1];
      const c3 = candles[i + 2];

      // Bullish FVG: candle 1 high < candle 3 low
      if (c1.high < c3.low) {
        const filled = this.isFVGFilled(candles, i + 2, c1.high, c3.low);
        fvgs.push({
          type: 'bullish',
          top: c3.low,
          bottom: c1.high,
          startIndex: i,
          filled,
          size: c3.low - c1.high,
        });
      }

      // Bearish FVG: candle 1 low > candle 3 high
      if (c1.low > c3.high) {
        const filled = this.isFVGFilled(candles, i + 2, c3.high, c1.low);
        fvgs.push({
          type: 'bearish',
          top: c1.low,
          bottom: c3.high,
          startIndex: i,
          filled,
          size: c1.low - c3.high,
        });
      }
    }

    return fvgs.slice(-15); // Keep last 15 FVGs
  }

  /**
   * Check if FVG has been filled
   */
  private isFVGFilled(candles: OHLCV[], startIndex: number, bottom: number, top: number): boolean {
    for (let i = startIndex; i < candles.length; i++) {
      if (candles[i].low <= bottom || candles[i].high >= top) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find Break of Structure using swing points
   */
  private findBreakOfStructure(candles: OHLCV[]): BreakOfStructure[] {
    const swings = this.findSwingPoints(candles, 5);
    const bosEvents: BreakOfStructure[] = [];

    for (let i = 0; i < swings.length - 1; i++) {
      const current = swings[i];
      const next = swings[i + 1];

      // Bullish BOS: price breaks above previous swing high
      if (current.type === 'high' && next.type === 'high' && next.price > current.price) {
        bosEvents.push({
          type: 'bullish',
          price: next.price,
          index: next.index,
          timestamp: next.timestamp,
          previousSwing: current.price,
        });
      }

      // Bearish BOS: price breaks below previous swing low
      if (current.type === 'low' && next.type === 'low' && next.price < current.price) {
        bosEvents.push({
          type: 'bearish',
          price: next.price,
          index: next.index,
          timestamp: next.timestamp,
          previousSwing: current.price,
        });
      }
    }

    return bosEvents.slice(-10);
  }

  /**
   * Find Change of Character (first BOS against trend)
   */
  private findChangeOfCharacter(candles: OHLCV[]): ChangeOfCharacter[] {
    const swings = this.findSwingPoints(candles, 5);
    const chochEvents: ChangeOfCharacter[] = [];
    
    let currentTrend: 'bullish' | 'bearish' | null = null;

    for (let i = 2; i < swings.length; i++) {
      const prev2 = swings[i - 2];
      const prev1 = swings[i - 1];
      const current = swings[i];

      // Establish trend
      if (prev2.type === 'low' && prev1.type === 'high' && current.type === 'low') {
        if (current.price > prev2.price && prev1.price > swings[i - 3]?.price) {
          currentTrend = 'bullish';
        } else if (current.price < prev2.price) {
          currentTrend = 'bearish';
        }
      }

      // Bullish CHoCH: breaking swing high after downtrend
      if (currentTrend === 'bearish' && current.type === 'high' && prev1.type === 'high' && current.price > prev1.price) {
        chochEvents.push({
          type: 'bullish',
          price: current.price,
          index: current.index,
          timestamp: current.timestamp,
          previousTrend: 'bearish',
        });
        currentTrend = 'bullish';
      }

      // Bearish CHoCH: breaking swing low after uptrend
      if (currentTrend === 'bullish' && current.type === 'low' && prev1.type === 'low' && current.price < prev1.price) {
        chochEvents.push({
          type: 'bearish',
          price: current.price,
          index: current.index,
          timestamp: current.timestamp,
          previousTrend: 'bullish',
        });
        currentTrend = 'bearish';
      }
    }

    return chochEvents.slice(-5);
  }

  /**
   * Find liquidity zones (equal highs/lows, previous period levels)
   */
  private findLiquidityZones(candles: OHLCV[]): LiquidityZone[] {
    const zones: LiquidityZone[] = [];
    const tolerance = 0.001; // 0.1%
    const lookback = Math.min(100, candles.length);
    const currentPrice = candles[candles.length - 1].close;

    // Find equal highs
    const highs: { price: number; count: number }[] = [];
    for (let i = candles.length - lookback; i < candles.length; i++) {
      const high = candles[i].high;
      let found = false;
      
      for (const h of highs) {
        if (Math.abs(high - h.price) / h.price < tolerance) {
          h.count++;
          found = true;
          break;
        }
      }
      
      if (!found) {
        highs.push({ price: high, count: 1 });
      }
    }

    highs.filter(h => h.count >= 2).forEach(h => {
      zones.push({
        type: 'equal_highs',
        price: h.price,
        swept: currentPrice > h.price,
      });
    });

    // Find equal lows
    const lows: { price: number; count: number }[] = [];
    for (let i = candles.length - lookback; i < candles.length; i++) {
      const low = candles[i].low;
      let found = false;
      
      for (const l of lows) {
        if (Math.abs(low - l.price) / l.price < tolerance) {
          l.count++;
          found = true;
          break;
        }
      }
      
      if (!found) {
        lows.push({ price: low, count: 1 });
      }
    }

    lows.filter(l => l.count >= 2).forEach(l => {
      zones.push({
        type: 'equal_lows',
        price: l.price,
        swept: currentPrice < l.price,
      });
    });

    // Previous day/week levels
    const prevDayLevels = this.getPreviousPeriodLevels(candles, 'day');
    const prevWeekLevels = this.getPreviousPeriodLevels(candles, 'week');

    if (prevDayLevels.high) {
      zones.push({
        type: 'prev_day_high',
        price: prevDayLevels.high,
        swept: currentPrice > prevDayLevels.high,
      });
    }

    if (prevDayLevels.low) {
      zones.push({
        type: 'prev_day_low',
        price: prevDayLevels.low,
        swept: currentPrice < prevDayLevels.low,
      });
    }

    if (prevWeekLevels.high) {
      zones.push({
        type: 'prev_week_high',
        price: prevWeekLevels.high,
        swept: currentPrice > prevWeekLevels.high,
      });
    }

    if (prevWeekLevels.low) {
      zones.push({
        type: 'prev_week_low',
        price: prevWeekLevels.low,
        swept: currentPrice < prevWeekLevels.low,
      });
    }

    return zones;
  }

  /**
   * Check if current time is in a kill zone
   */
  private checkKillZone(timestamp: number): KillZone {
    const date = new Date(timestamp);
    const hour = date.getUTCHours();

    if (hour >= 2 && hour < 5) {
      return { current: 'london', isActive: true };
    }
    
    if (hour >= 12 && hour < 15) {
      return { current: 'ny_open', isActive: true };
    }
    
    if (hour >= 19 && hour < 21) {
      return { current: 'ny_close', isActive: true };
    }

    return { current: 'none', isActive: false };
  }

  /**
   * Calculate premium/discount zones based on swing range
   */
  private calculatePremiumDiscount(candles: OHLCV[]): PremiumDiscount {
    const swings = this.findSwingPoints(candles, 10);
    const recentSwings = swings.slice(-20);
    
    const highs = recentSwings.filter(s => s.type === 'high');
    const lows = recentSwings.filter(s => s.type === 'low');
    
    const swingHigh = highs.length > 0 ? Math.max(...highs.map(h => h.price)) : candles[candles.length - 1].high;
    const swingLow = lows.length > 0 ? Math.min(...lows.map(l => l.price)) : candles[candles.length - 1].low;
    
    const equilibrium = (swingHigh + swingLow) / 2;
    const currentPrice = candles[candles.length - 1].close;
    
    const distanceFromEq = ((currentPrice - equilibrium) / equilibrium) * 100;
    
    let currentZone: 'premium' | 'equilibrium' | 'discount';
    if (currentPrice > equilibrium * 1.02) {
      currentZone = 'premium';
    } else if (currentPrice < equilibrium * 0.98) {
      currentZone = 'discount';
    } else {
      currentZone = 'equilibrium';
    }

    return {
      swingHigh,
      swingLow,
      equilibrium,
      currentZone,
      distanceFromEquilibrium: distanceFromEq,
    };
  }

  /**
   * Determine overall market structure
   */
  private determineMarketStructure(candles: OHLCV[]): 'bullish' | 'bearish' | 'neutral' {
    const swings = this.findSwingPoints(candles, 5).slice(-10);
    
    if (swings.length < 4) return 'neutral';
    
    const recentHighs = swings.filter(s => s.type === 'high').slice(-3);
    const recentLows = swings.filter(s => s.type === 'low').slice(-3);
    
    if (recentHighs.length >= 2 && recentLows.length >= 2) {
      const higherHighs = recentHighs[recentHighs.length - 1].price > recentHighs[0].price;
      const higherLows = recentLows[recentLows.length - 1].price > recentLows[0].price;
      
      if (higherHighs && higherLows) return 'bullish';
      
      const lowerHighs = recentHighs[recentHighs.length - 1].price < recentHighs[0].price;
      const lowerLows = recentLows[recentLows.length - 1].price < recentLows[0].price;
      
      if (lowerHighs && lowerLows) return 'bearish';
    }
    
    return 'neutral';
  }

  /**
   * Find swing points (pivots) with configurable lookback
   */
  private findSwingPoints(candles: OHLCV[], lookback: number): Array<{ type: 'high' | 'low'; price: number; index: number; timestamp: number }> {
    const swings: Array<{ type: 'high' | 'low'; price: number; index: number; timestamp: number }> = [];
    
    for (let i = lookback; i < candles.length - lookback; i++) {
      const current = candles[i];
      let isSwingHigh = true;
      let isSwingLow = true;
      
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        if (candles[j].high >= current.high) isSwingHigh = false;
        if (candles[j].low <= current.low) isSwingLow = false;
      }
      
      if (isSwingHigh) {
        swings.push({
          type: 'high',
          price: current.high,
          index: i,
          timestamp: current.timestamp,
        });
      }
      
      if (isSwingLow) {
        swings.push({
          type: 'low',
          price: current.low,
          index: i,
          timestamp: current.timestamp,
        });
      }
    }
    
    return swings;
  }

  /**
   * Get previous period high/low
   */
  private getPreviousPeriodLevels(candles: OHLCV[], period: 'day' | 'week'): { high: number | null; low: number | null } {
    const MS_PER_DAY = 86400000;
    const periodMs = period === 'day' ? MS_PER_DAY : MS_PER_DAY * 7;
    
    const latestTime = candles[candles.length - 1].timestamp;
    const previousPeriodStart = latestTime - periodMs * 2;
    const previousPeriodEnd = latestTime - periodMs;
    
    const previousCandles = candles.filter(c => c.timestamp >= previousPeriodStart && c.timestamp < previousPeriodEnd);
    
    if (previousCandles.length === 0) {
      return { high: null, low: null };
    }
    
    return {
      high: Math.max(...previousCandles.map(c => c.high)),
      low: Math.min(...previousCandles.map(c => c.low)),
    };
  }

  /**
   * Calculate ATR for displacement detection
   */
  private calculateATR(candles: OHLCV[]): number {
    const result = ATR.calculate({
      high: candles.map(c => c.high),
      low: candles.map(c => c.low),
      close: candles.map(c => c.close),
      period: 14,
    });
    
    return result.length > 0 ? result[result.length - 1] : 0;
  }
}
