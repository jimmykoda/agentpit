// ============================================
// AgentPit - Wyckoff Analysis Engine
// Accumulation/Distribution phase detection
// ============================================

import { OHLCV, WyckoffAnalysis, WyckoffPhase, Spring, EffortResult } from '../types';
import { createLogger } from '../utils/logger';
import { SMA } from 'technicalindicators';

const log = createLogger('WyckoffEngine');

export class WyckoffEngine {

  /**
   * Calculate Wyckoff analysis from candle data
   */
  calculate(candles: OHLCV[]): WyckoffAnalysis {
    if (candles.length < 50) {
      log.warn(`Only ${candles.length} candles available for Wyckoff analysis`);
    }

    const volumePriceAnalysis = this.analyzeVolumePriceRelationship(candles);
    const currentPhase = this.detectPhase(candles, volumePriceAnalysis);
    const springs = this.detectSprings(candles);
    const effortVsResult = this.analyzeEffortVsResult(candles);
    const signal = this.generateSignal(currentPhase, springs, volumePriceAnalysis);
    
    // Calculate phase confidence based on multiple factors
    const phaseConfidence = this.calculatePhaseConfidence(currentPhase, volumePriceAnalysis, candles);

    return {
      currentPhase,
      phaseConfidence,
      volumePriceAnalysis,
      springs,
      effortVsResult,
      signal,
    };
  }

  /**
   * Analyze volume-price relationship over different periods
   */
  private analyzeVolumePriceRelationship(candles: OHLCV[]): EffortResult[] {
    const periods = [5, 10, 20];
    const results: EffortResult[] = [];

    for (const period of periods) {
      if (candles.length < period + 1) continue;

      const recentCandles = candles.slice(-period);
      const priceChange = recentCandles[recentCandles.length - 1].close - recentCandles[0].open;
      const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / period;
      
      const volumeChanges: number[] = [];
      for (let i = 1; i < recentCandles.length; i++) {
        volumeChanges.push(recentCandles[i].volume - recentCandles[i - 1].volume);
      }
      const avgVolumeChange = volumeChanges.reduce((sum, v) => sum + v, 0) / volumeChanges.length;

      const priceTrend = priceChange > avgVolume * 0.01 ? 'rising' : priceChange < -avgVolume * 0.01 ? 'falling' : 'flat';
      const volumeTrend = avgVolumeChange > avgVolume * 0.1 ? 'rising' : avgVolumeChange < -avgVolume * 0.1 ? 'falling' : 'flat';

      let interpretation: 'accumulation' | 'distribution' | 'strength' | 'weakness' | 'neutral';

      if (priceTrend === 'rising' && volumeTrend === 'falling') {
        interpretation = 'distribution';
      } else if (priceTrend === 'falling' && volumeTrend === 'falling') {
        interpretation = 'accumulation';
      } else if (priceTrend === 'rising' && volumeTrend === 'rising') {
        interpretation = 'strength';
      } else if (priceTrend === 'falling' && volumeTrend === 'rising') {
        interpretation = 'weakness';
      } else {
        interpretation = 'neutral';
      }

      results.push({
        period: `recent_${period}` as 'recent_5' | 'recent_10' | 'recent_20',
        volumeTrend,
        priceTrend,
        interpretation,
      });
    }

    return results;
  }

  /**
   * Detect current Wyckoff phase
   */
  private detectPhase(candles: OHLCV[], volumePriceAnalysis: EffortResult[]): WyckoffPhase {
    const recent = candles.slice(-20);
    
    if (recent.length < 10) return 'unknown';

    const priceVolatility = this.calculateVolatility(recent);
    const volumeAvg = recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
    const recentVolume = recent.slice(-5).reduce((sum, c) => sum + c.volume, 0) / 5;
    
    const priceChange = recent[recent.length - 1].close - recent[0].open;
    const priceChangePercent = (priceChange / recent[0].open) * 100;

    // Check volume-price interpretations
    const accumulationCount = volumePriceAnalysis.filter(v => v.interpretation === 'accumulation').length;
    const distributionCount = volumePriceAnalysis.filter(v => v.interpretation === 'distribution').length;
    const strengthCount = volumePriceAnalysis.filter(v => v.interpretation === 'strength').length;
    const weaknessCount = volumePriceAnalysis.filter(v => v.interpretation === 'weakness').length;

    // Accumulation: falling/flat price, declining volume, low volatility
    if (accumulationCount >= 2 && priceVolatility < volumeAvg * 0.05 && Math.abs(priceChangePercent) < 2) {
      return 'accumulation';
    }

    // Markup: rising price, rising volume
    if (strengthCount >= 2 && priceChangePercent > 3) {
      return 'markup';
    }

    // Distribution: rising price, declining volume
    if (distributionCount >= 2 && priceChangePercent > 0) {
      return 'distribution';
    }

    // Markdown: falling price, rising volume
    if (weaknessCount >= 2 && priceChangePercent < -3) {
      return 'markdown';
    }

    return 'unknown';
  }

  /**
   * Detect springs (bullish) and upthrusts (bearish)
   */
  private detectSprings(candles: OHLCV[]): Spring[] {
    const springs: Spring[] = [];
    const lookback = Math.min(100, candles.length);
    const supportResistanceLevels = this.findKeyLevels(candles);

    for (let i = candles.length - lookback; i < candles.length - 2; i++) {
      const prev = candles[i - 1];
      const current = candles[i];
      const next = candles[i + 1];
      
      if (!prev || !next) continue;

      // Find nearest support
      const nearestSupport = supportResistanceLevels.supports
        .filter(s => s < current.low)
        .sort((a, b) => b - a)[0];

      // Bullish spring: price breaks below support then reverses back above
      if (nearestSupport && current.low < nearestSupport && current.close > nearestSupport && next.close > current.close) {
        springs.push({
          type: 'bullish_spring',
          index: i,
          price: current.low,
          timestamp: current.timestamp,
        });
      }

      // Find nearest resistance
      const nearestResistance = supportResistanceLevels.resistances
        .filter(r => r > current.high)
        .sort((a, b) => a - b)[0];

      // Bearish upthrust: price breaks above resistance then reverses back below
      if (nearestResistance && current.high > nearestResistance && current.close < nearestResistance && next.close < current.close) {
        springs.push({
          type: 'bearish_upthrust',
          index: i,
          price: current.high,
          timestamp: current.timestamp,
        });
      }
    }

    return springs.slice(-10);
  }

  /**
   * Analyze effort (volume) vs result (price movement)
   */
  private analyzeEffortVsResult(candles: OHLCV[]): string {
    const recent = candles.slice(-10);
    
    if (recent.length < 5) return 'Insufficient data';

    const totalVolume = recent.reduce((sum, c) => sum + c.volume, 0);
    const avgVolume = totalVolume / recent.length;
    const priceChange = Math.abs(recent[recent.length - 1].close - recent[0].open);
    const priceChangePercent = (priceChange / recent[0].open) * 100;

    const recentVolume = recent.slice(-3).reduce((sum, c) => sum + c.volume, 0) / 3;
    const volumeRatio = recentVolume / avgVolume;

    // High volume, small price movement = absorption
    if (volumeRatio > 1.5 && priceChangePercent < 1) {
      return 'High effort, low result: Absorption detected (potential reversal)';
    }

    // Low volume, large price movement = lack of resistance
    if (volumeRatio < 0.7 && priceChangePercent > 2) {
      return 'Low effort, high result: Lack of opposition (trend continuation)';
    }

    // High volume, large price movement = strong move
    if (volumeRatio > 1.3 && priceChangePercent > 2) {
      return 'High effort, high result: Strong directional move (genuine trend)';
    }

    // Low volume, small movement = consolidation
    if (volumeRatio < 0.8 && priceChangePercent < 1) {
      return 'Low effort, low result: Consolidation phase';
    }

    return 'Normal effort vs result ratio';
  }

  /**
   * Generate trading signal based on Wyckoff analysis
   */
  private generateSignal(phase: WyckoffPhase, springs: Spring[], volumePriceAnalysis: EffortResult[]): 'buy' | 'sell' | 'neutral' {
    const recentSpring = springs.length > 0 ? springs[springs.length - 1] : null;
    
    // Buy signals
    if (phase === 'accumulation' && recentSpring?.type === 'bullish_spring') {
      return 'buy';
    }
    
    if (phase === 'markup') {
      return 'buy';
    }

    // Sell signals
    if (phase === 'distribution' && recentSpring?.type === 'bearish_upthrust') {
      return 'sell';
    }
    
    if (phase === 'markdown') {
      return 'sell';
    }

    // Check volume-price analysis for additional signals
    const strengthSignals = volumePriceAnalysis.filter(v => v.interpretation === 'strength').length;
    const weaknessSignals = volumePriceAnalysis.filter(v => v.interpretation === 'weakness').length;

    if (strengthSignals >= 2 && weaknessSignals === 0) {
      return 'buy';
    }

    if (weaknessSignals >= 2 && strengthSignals === 0) {
      return 'sell';
    }

    return 'neutral';
  }

  /**
   * Calculate phase confidence (0-100)
   */
  private calculatePhaseConfidence(phase: WyckoffPhase, volumePriceAnalysis: EffortResult[], candles: OHLCV[]): number {
    if (phase === 'unknown') return 0;

    let confidence = 50; // Base confidence

    // Check if multiple periods agree on the interpretation
    const phaseKeywords: { [key in WyckoffPhase]: string[] } = {
      accumulation: ['accumulation'],
      distribution: ['distribution'],
      markup: ['strength'],
      markdown: ['weakness'],
      unknown: [],
    };

    const keywords = phaseKeywords[phase];
    const matchingAnalysis = volumePriceAnalysis.filter(v => keywords.includes(v.interpretation));
    
    confidence += matchingAnalysis.length * 15;

    // Check volume consistency
    const recent = candles.slice(-10);
    const volumeStdDev = this.calculateStdDev(recent.map(c => c.volume));
    const avgVolume = recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
    const volumeCV = volumeStdDev / avgVolume;

    if (volumeCV < 0.5) {
      confidence += 10; // Consistent volume increases confidence
    }

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Find key support and resistance levels
   */
  private findKeyLevels(candles: OHLCV[]): { supports: number[]; resistances: number[] } {
    const lookback = Math.min(50, candles.length);
    const recent = candles.slice(-lookback);
    
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);
    
    const resistances = this.findLocalMaxima(highs, 5).slice(-5);
    const supports = this.findLocalMinima(lows, 5).slice(-5);

    return { supports, resistances };
  }

  /**
   * Find local maxima in array
   */
  private findLocalMaxima(arr: number[], window: number): number[] {
    const maxima: number[] = [];
    
    for (let i = window; i < arr.length - window; i++) {
      let isMax = true;
      for (let j = i - window; j <= i + window; j++) {
        if (j !== i && arr[j] >= arr[i]) {
          isMax = false;
          break;
        }
      }
      if (isMax) maxima.push(arr[i]);
    }
    
    return maxima;
  }

  /**
   * Find local minima in array
   */
  private findLocalMinima(arr: number[], window: number): number[] {
    const minima: number[] = [];
    
    for (let i = window; i < arr.length - window; i++) {
      let isMin = true;
      for (let j = i - window; j <= i + window; j++) {
        if (j !== i && arr[j] <= arr[i]) {
          isMin = false;
          break;
        }
      }
      if (isMin) minima.push(arr[i]);
    }
    
    return minima;
  }

  /**
   * Calculate price volatility
   */
  private calculateVolatility(candles: OHLCV[]): number {
    const ranges = candles.map(c => c.high - c.low);
    return ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(variance);
  }
}
