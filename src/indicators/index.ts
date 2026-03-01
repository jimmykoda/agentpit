// ============================================
// AgentPit - Advanced Indicator Engine
// Unified interface for all indicator engines
// ============================================

import { OHLCV, AdvancedIndicatorAnalysis } from '../types';
import { ICTEngine } from './ict-engine';
import { FibonacciEngine } from './fibonacci-engine';
import { StructureEngine } from './structure-engine';
import { WyckoffEngine } from './wyckoff-engine';
import { createLogger } from '../utils/logger';

const log = createLogger('AdvancedIndicators');

export class AdvancedIndicatorEngine {
  private ictEngine: ICTEngine;
  private fibonacciEngine: FibonacciEngine;
  private structureEngine: StructureEngine;
  private wyckoffEngine: WyckoffEngine;

  constructor() {
    this.ictEngine = new ICTEngine();
    this.fibonacciEngine = new FibonacciEngine();
    this.structureEngine = new StructureEngine();
    this.wyckoffEngine = new WyckoffEngine();
  }

  /**
   * Calculate all advanced indicators
   */
  calculate(candles: OHLCV[], currentTime?: number): AdvancedIndicatorAnalysis {
    if (candles.length < 50) {
      log.warn(`Only ${candles.length} candles available for advanced indicator analysis`);
    }

    try {
      const ict = this.ictEngine.calculate(candles, currentTime);
      const fibonacci = this.fibonacciEngine.calculate(candles);
      const structure = this.structureEngine.calculate(candles);
      const wyckoff = this.wyckoffEngine.calculate(candles);

      return {
        ict,
        fibonacci,
        structure,
        wyckoff,
        timestamp: currentTime || candles[candles.length - 1].timestamp,
      };
    } catch (error) {
      log.error('Error calculating advanced indicators:', error);
      
      return {
        ict: null,
        fibonacci: null,
        structure: null,
        wyckoff: null,
        timestamp: currentTime || candles[candles.length - 1].timestamp,
      };
    }
  }

  /**
   * Calculate only ICT analysis
   */
  calculateICT(candles: OHLCV[], currentTime?: number) {
    return this.ictEngine.calculate(candles, currentTime);
  }

  /**
   * Calculate only Fibonacci analysis
   */
  calculateFibonacci(candles: OHLCV[]) {
    return this.fibonacciEngine.calculate(candles);
  }

  /**
   * Calculate only Structure analysis
   */
  calculateStructure(candles: OHLCV[]) {
    return this.structureEngine.calculate(candles);
  }

  /**
   * Calculate only Wyckoff analysis
   */
  calculateWyckoff(candles: OHLCV[]) {
    return this.wyckoffEngine.calculate(candles);
  }
}

// Export individual engines
export { ICTEngine } from './ict-engine';
export { FibonacciEngine } from './fibonacci-engine';
export { StructureEngine } from './structure-engine';
export { WyckoffEngine } from './wyckoff-engine';
