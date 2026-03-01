// ============================================
// AgentPit - Fibonacci Analysis Engine
// Auto swing detection and Fibonacci levels
// ============================================

import { OHLCV, FibonacciAnalysis, SwingPoint, FibLevel } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('FibonacciEngine');

export class FibonacciEngine {

  /**
   * Calculate Fibonacci analysis from candle data
   */
  calculate(candles: OHLCV[], lookback: number = 10): FibonacciAnalysis {
    if (candles.length < lookback * 2) {
      log.warn(`Only ${candles.length} candles available for Fibonacci analysis`);
    }

    const swingHigh = this.findSwingHigh(candles, lookback);
    const swingLow = this.findSwingLow(candles, lookback);
    
    const retracementLevels = this.calculateRetracementLevels(swingHigh, swingLow);
    const extensionLevels = this.calculateExtensionLevels(swingHigh, swingLow);
    const goldenPocket = this.calculateGoldenPocket(swingHigh, swingLow);
    const trendDirection = this.determineTrendDirection(swingHigh, swingLow);
    
    const currentPrice = candles[candles.length - 1].close;
    const nearestLevel = this.findNearestLevel([...retracementLevels, ...extensionLevels], currentPrice);
    
    const currentPriceInGoldenPocket = goldenPocket 
      ? currentPrice >= goldenPocket.bottom && currentPrice <= goldenPocket.top
      : false;

    return {
      swingHigh,
      swingLow,
      retracementLevels,
      extensionLevels,
      goldenPocket,
      nearestLevel,
      trendDirection,
      currentPriceInGoldenPocket,
    };
  }

  /**
   * Find the most recent swing high
   */
  private findSwingHigh(candles: OHLCV[], lookback: number): SwingPoint | null {
    const searchRange = Math.min(100, candles.length);
    
    for (let i = candles.length - lookback - 1; i >= candles.length - searchRange; i--) {
      if (i < lookback || i >= candles.length - lookback) continue;
      
      const current = candles[i];
      let isSwingHigh = true;
      
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        if (candles[j].high >= current.high) {
          isSwingHigh = false;
          break;
        }
      }
      
      if (isSwingHigh) {
        return {
          type: 'high',
          price: current.high,
          index: i,
          timestamp: current.timestamp,
        };
      }
    }
    
    return null;
  }

  /**
   * Find the most recent swing low
   */
  private findSwingLow(candles: OHLCV[], lookback: number): SwingPoint | null {
    const searchRange = Math.min(100, candles.length);
    
    for (let i = candles.length - lookback - 1; i >= candles.length - searchRange; i--) {
      if (i < lookback || i >= candles.length - lookback) continue;
      
      const current = candles[i];
      let isSwingLow = true;
      
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        if (candles[j].low <= current.low) {
          isSwingLow = false;
          break;
        }
      }
      
      if (isSwingLow) {
        return {
          type: 'low',
          price: current.low,
          index: i,
          timestamp: current.timestamp,
        };
      }
    }
    
    return null;
  }

  /**
   * Calculate Fibonacci retracement levels
   */
  private calculateRetracementLevels(swingHigh: SwingPoint | null, swingLow: SwingPoint | null): FibLevel[] {
    if (!swingHigh || !swingLow) return [];
    
    const high = swingHigh.price;
    const low = swingLow.price;
    const range = high - low;
    
    const levels = [
      { level: 0, label: '0.0' },
      { level: 0.236, label: '0.236' },
      { level: 0.382, label: '0.382' },
      { level: 0.5, label: '0.5' },
      { level: 0.618, label: '0.618' },
      { level: 0.786, label: '0.786' },
      { level: 1.0, label: '1.0' },
    ];
    
    return levels.map(l => ({
      level: l.level,
      price: high - (range * l.level),
      label: l.label,
    }));
  }

  /**
   * Calculate Fibonacci extension levels for take profit targets
   */
  private calculateExtensionLevels(swingHigh: SwingPoint | null, swingLow: SwingPoint | null): FibLevel[] {
    if (!swingHigh || !swingLow) return [];
    
    const high = swingHigh.price;
    const low = swingLow.price;
    const range = high - low;
    
    const isUptrend = swingLow.index < swingHigh.index;
    
    const levels = [
      { level: 1.272, label: '1.272' },
      { level: 1.618, label: '1.618' },
      { level: 2.0, label: '2.0' },
      { level: 2.618, label: '2.618' },
    ];
    
    if (isUptrend) {
      // Extensions above the high for uptrend
      return levels.map(l => ({
        level: l.level,
        price: high + (range * (l.level - 1.0)),
        label: l.label,
      }));
    } else {
      // Extensions below the low for downtrend
      return levels.map(l => ({
        level: l.level,
        price: low - (range * (l.level - 1.0)),
        label: l.label,
      }));
    }
  }

  /**
   * Calculate the golden pocket (0.618-0.65 zone)
   */
  private calculateGoldenPocket(swingHigh: SwingPoint | null, swingLow: SwingPoint | null): { top: number; bottom: number } | null {
    if (!swingHigh || !swingLow) return null;
    
    const high = swingHigh.price;
    const low = swingLow.price;
    const range = high - low;
    
    return {
      top: high - (range * 0.618),
      bottom: high - (range * 0.65),
    };
  }

  /**
   * Determine trend direction based on swing sequence
   */
  private determineTrendDirection(swingHigh: SwingPoint | null, swingLow: SwingPoint | null): 'uptrend' | 'downtrend' | 'unknown' {
    if (!swingHigh || !swingLow) return 'unknown';
    
    if (swingLow.index < swingHigh.index) {
      return 'uptrend';
    } else {
      return 'downtrend';
    }
  }

  /**
   * Find the nearest Fibonacci level to current price
   */
  private findNearestLevel(levels: FibLevel[], currentPrice: number): FibLevel | null {
    if (levels.length === 0) return null;
    
    let nearest = levels[0];
    let minDistance = Math.abs(currentPrice - levels[0].price);
    
    for (const level of levels) {
      const distance = Math.abs(currentPrice - level.price);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = level;
      }
    }
    
    return nearest;
  }
}
