// ============================================
// AgentPit - Structure Analysis Engine
// Support/Resistance + Volume Profile
// ============================================

import { OHLCV, StructureAnalysis, SupportResistanceLevel, DynamicLevel, PreviousPeriodLevels, VolumeProfile } from '../types';
import { createLogger } from '../utils/logger';
import { EMA } from 'technicalindicators';

const log = createLogger('StructureEngine');

export class StructureEngine {

  /**
   * Calculate structure analysis from candle data
   */
  calculate(candles: OHLCV[]): StructureAnalysis {
    if (candles.length < 50) {
      log.warn(`Only ${candles.length} candles available for Structure analysis`);
    }

    const currentPrice = candles[candles.length - 1].close;
    const horizontalLevels = this.findHorizontalLevels(candles);
    const dynamicLevels = this.calculateDynamicLevels(candles, currentPrice);
    const previousPeriodLevels = this.calculatePreviousPeriodLevels(candles);
    const volumeProfile = this.calculateVolumeProfile(candles);

    const nearestSupport = this.findNearestSupport(horizontalLevels, currentPrice);
    const nearestResistance = this.findNearestResistance(horizontalLevels, currentPrice);

    return {
      horizontalLevels,
      dynamicLevels,
      previousPeriodLevels,
      volumeProfile,
      nearestSupport,
      nearestResistance,
    };
  }

  /**
   * Find horizontal support/resistance levels using cluster analysis
   */
  private findHorizontalLevels(candles: OHLCV[]): SupportResistanceLevel[] {
    const tolerance = 0.003; // 0.3% tolerance
    const minTouches = 3;
    const lookback = Math.min(200, candles.length);
    
    const pricePoints: Array<{ price: number; timestamp: number; type: 'high' | 'low' }> = [];
    
    // Collect all highs and lows
    for (let i = candles.length - lookback; i < candles.length; i++) {
      pricePoints.push({ price: candles[i].high, timestamp: candles[i].timestamp, type: 'high' });
      pricePoints.push({ price: candles[i].low, timestamp: candles[i].timestamp, type: 'low' });
    }
    
    // Cluster similar prices
    const clusters: Array<{ price: number; touches: number; lastTouch: number; type: 'support' | 'resistance' }> = [];
    
    for (const point of pricePoints) {
      let foundCluster = false;
      
      for (const cluster of clusters) {
        if (Math.abs(point.price - cluster.price) / cluster.price < tolerance) {
          cluster.touches++;
          cluster.price = (cluster.price * (cluster.touches - 1) + point.price) / cluster.touches; // Average
          cluster.lastTouch = Math.max(cluster.lastTouch, point.timestamp);
          foundCluster = true;
          break;
        }
      }
      
      if (!foundCluster) {
        clusters.push({
          price: point.price,
          touches: 1,
          lastTouch: point.timestamp,
          type: point.type === 'low' ? 'support' : 'resistance',
        });
      }
    }
    
    // Filter and score levels
    const levels = clusters
      .filter(c => c.touches >= minTouches)
      .map(c => {
        const recencyScore = (c.lastTouch - candles[0].timestamp) / (candles[candles.length - 1].timestamp - candles[0].timestamp);
        const strength = c.touches * (0.5 + recencyScore * 0.5);
        
        return {
          price: c.price,
          touches: c.touches,
          strength,
          type: c.type,
          lastTouch: c.lastTouch,
        };
      })
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 20); // Keep top 20 levels

    return levels;
  }

  /**
   * Calculate dynamic support/resistance using EMAs
   */
  private calculateDynamicLevels(candles: OHLCV[], currentPrice: number): DynamicLevel {
    const closes = candles.map(c => c.close);
    
    const ema21 = this.calcEMA(closes, 21);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    
    const priceVsEma21 = ema21 ? (currentPrice > ema21 * 1.001 ? 'above' : currentPrice < ema21 * 0.999 ? 'below' : 'at') : 'at';
    const priceVsEma50 = ema50 ? (currentPrice > ema50 * 1.001 ? 'above' : currentPrice < ema50 * 0.999 ? 'below' : 'at') : 'at';
    const priceVsEma200 = ema200 ? (currentPrice > ema200 * 1.001 ? 'above' : currentPrice < ema200 * 0.999 ? 'below' : 'at') : 'at';
    
    return {
      ema21,
      ema50,
      ema200,
      priceVsEma21,
      priceVsEma50,
      priceVsEma200,
    };
  }

  /**
   * Calculate previous day/week levels
   */
  private calculatePreviousPeriodLevels(candles: OHLCV[]): PreviousPeriodLevels {
    const MS_PER_DAY = 86400000;
    const latestTime = candles[candles.length - 1].timestamp;
    
    // Previous day
    const prevDayStart = latestTime - MS_PER_DAY * 2;
    const prevDayEnd = latestTime - MS_PER_DAY;
    const prevDayCandles = candles.filter(c => c.timestamp >= prevDayStart && c.timestamp < prevDayEnd);
    
    const prevDayHigh = prevDayCandles.length > 0 ? Math.max(...prevDayCandles.map(c => c.high)) : null;
    const prevDayLow = prevDayCandles.length > 0 ? Math.min(...prevDayCandles.map(c => c.low)) : null;
    const prevDayClose = prevDayCandles.length > 0 ? prevDayCandles[prevDayCandles.length - 1].close : null;
    
    // Previous week
    const prevWeekStart = latestTime - MS_PER_DAY * 14;
    const prevWeekEnd = latestTime - MS_PER_DAY * 7;
    const prevWeekCandles = candles.filter(c => c.timestamp >= prevWeekStart && c.timestamp < prevWeekEnd);
    
    const prevWeekHigh = prevWeekCandles.length > 0 ? Math.max(...prevWeekCandles.map(c => c.high)) : null;
    const prevWeekLow = prevWeekCandles.length > 0 ? Math.min(...prevWeekCandles.map(c => c.low)) : null;
    const prevWeekClose = prevWeekCandles.length > 0 ? prevWeekCandles[prevWeekCandles.length - 1].close : null;
    
    return {
      prevDayHigh,
      prevDayLow,
      prevDayClose,
      prevWeekHigh,
      prevWeekLow,
      prevWeekClose,
    };
  }

  /**
   * Calculate simplified volume profile
   */
  private calculateVolumeProfile(candles: OHLCV[]): VolumeProfile {
    const lookback = Math.min(100, candles.length);
    const recentCandles = candles.slice(-lookback);
    
    const priceHigh = Math.max(...recentCandles.map(c => c.high));
    const priceLow = Math.min(...recentCandles.map(c => c.low));
    const priceRange = priceHigh - priceLow;
    
    const bucketCount = 50;
    const bucketSize = priceRange / bucketCount;
    
    // Create buckets
    const buckets: Array<{ price: number; volume: number }> = [];
    for (let i = 0; i < bucketCount; i++) {
      buckets.push({
        price: priceLow + (i * bucketSize) + (bucketSize / 2),
        volume: 0,
      });
    }
    
    // Distribute volume across buckets
    for (const candle of recentCandles) {
      const candleMid = (candle.high + candle.low) / 2;
      const bucketIndex = Math.min(Math.floor((candleMid - priceLow) / bucketSize), bucketCount - 1);
      if (bucketIndex >= 0) {
        buckets[bucketIndex].volume += candle.volume;
      }
    }
    
    // Find point of control (highest volume)
    let pocBucket = buckets[0];
    for (const bucket of buckets) {
      if (bucket.volume > pocBucket.volume) {
        pocBucket = bucket;
      }
    }
    
    // Calculate value area (70% of volume)
    const totalVolume = buckets.reduce((sum, b) => sum + b.volume, 0);
    const targetVolume = totalVolume * 0.7;
    
    buckets.sort((a, b) => b.volume - a.volume);
    
    let accumulatedVolume = 0;
    const valueAreaBuckets: typeof buckets = [];
    
    for (const bucket of buckets) {
      if (accumulatedVolume < targetVolume) {
        valueAreaBuckets.push(bucket);
        accumulatedVolume += bucket.volume;
      } else {
        break;
      }
    }
    
    const valueAreaPrices = valueAreaBuckets.map(b => b.price).sort((a, b) => a - b);
    const valueAreaHigh = valueAreaPrices.length > 0 ? valueAreaPrices[valueAreaPrices.length - 1] : pocBucket.price;
    const valueAreaLow = valueAreaPrices.length > 0 ? valueAreaPrices[0] : pocBucket.price;
    
    // High and low volume nodes
    const avgVolume = totalVolume / buckets.length;
    buckets.sort((a, b) => a.price - b.price);
    
    const highVolumeNodes = buckets.filter(b => b.volume > avgVolume * 1.5).map(b => b.price).slice(0, 5);
    const lowVolumeNodes = buckets.filter(b => b.volume < avgVolume * 0.5).map(b => b.price).slice(0, 5);
    
    return {
      pointOfControl: pocBucket.price,
      valueAreaHigh,
      valueAreaLow,
      highVolumeNodes,
      lowVolumeNodes,
    };
  }

  /**
   * Find nearest support level below current price
   */
  private findNearestSupport(levels: SupportResistanceLevel[], currentPrice: number): number | null {
    const supports = levels
      .filter(l => l.type === 'support' && l.price < currentPrice)
      .sort((a, b) => b.price - a.price);
    
    return supports.length > 0 ? supports[0].price : null;
  }

  /**
   * Find nearest resistance level above current price
   */
  private findNearestResistance(levels: SupportResistanceLevel[], currentPrice: number): number | null {
    const resistances = levels
      .filter(l => l.type === 'resistance' && l.price > currentPrice)
      .sort((a, b) => a.price - b.price);
    
    return resistances.length > 0 ? resistances[0].price : null;
  }

  /**
   * Calculate EMA helper
   */
  private calcEMA(closes: number[], period: number): number | null {
    if (closes.length < period) return null;
    const result = EMA.calculate({ values: closes, period });
    return result.length > 0 ? result[result.length - 1] : null;
  }
}
