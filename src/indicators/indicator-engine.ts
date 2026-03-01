// ============================================
// AgentPit - Technical Indicator Engine
// Calculates indicators from OHLCV data
// ============================================

import {
  RSI, MACD, BollingerBands, EMA, SMA, ATR, StochasticRSI,
} from 'technicalindicators';
import { OHLCV, Indicators, MACDResult, BollingerBandResult, StochRSIResult } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('Indicators');

export class IndicatorEngine {

  /**
   * Calculate all indicators for a set of candles
   */
  calculate(candles: OHLCV[]): Indicators {
    if (candles.length < 50) {
      log.warn(`Only ${candles.length} candles available, some indicators may be null`);
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    return {
      rsi: this.calcRSI(closes),
      macd: this.calcMACD(closes),
      bollingerBands: this.calcBollingerBands(closes),
      ema: {
        ema9: this.calcEMA(closes, 9),
        ema21: this.calcEMA(closes, 21),
        ema50: this.calcEMA(closes, 50),
        ema200: this.calcEMA(closes, 200),
      },
      sma: {
        sma20: this.calcSMA(closes, 20),
        sma50: this.calcSMA(closes, 50),
      },
      atr: this.calcATR(highs, lows, closes),
      volume: this.calcVolumeProfile(volumes),
      stochRSI: this.calcStochRSI(closes),
    };
  }

  private calcRSI(closes: number[], period: number = 14): number | null {
    const result = RSI.calculate({ values: closes, period });
    return result.length > 0 ? result[result.length - 1] : null;
  }

  private calcMACD(closes: number[]): MACDResult | null {
    const result = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    if (result.length === 0) return null;
    const last = result[result.length - 1];
    if (last.MACD === undefined || last.signal === undefined || last.histogram === undefined) return null;

    return {
      macd: last.MACD,
      signal: last.signal,
      histogram: last.histogram,
    };
  }

  private calcBollingerBands(closes: number[]): BollingerBandResult | null {
    const result = BollingerBands.calculate({
      values: closes,
      period: 20,
      stdDev: 2,
    });

    if (result.length === 0) return null;
    const last = result[result.length - 1];

    return {
      upper: last.upper,
      middle: last.middle,
      lower: last.lower,
      bandwidth: (last.upper - last.lower) / last.middle,
    };
  }

  private calcEMA(closes: number[], period: number): number | null {
    if (closes.length < period) return null;
    const result = EMA.calculate({ values: closes, period });
    return result.length > 0 ? result[result.length - 1] : null;
  }

  private calcSMA(closes: number[], period: number): number | null {
    if (closes.length < period) return null;
    const result = SMA.calculate({ values: closes, period });
    return result.length > 0 ? result[result.length - 1] : null;
  }

  private calcATR(highs: number[], lows: number[], closes: number[]): number | null {
    const result = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
    });
    return result.length > 0 ? result[result.length - 1] : null;
  }

  private calcVolumeProfile(volumes: number[]) {
    const current = volumes[volumes.length - 1] || 0;
    const avg = volumes.length > 0
      ? volumes.reduce((a, b) => a + b, 0) / volumes.length
      : 0;

    return {
      current,
      average: avg,
      ratio: avg > 0 ? current / avg : 0,
    };
  }

  private calcStochRSI(closes: number[]): StochRSIResult | null {
    const result = StochasticRSI.calculate({
      values: closes,
      rsiPeriod: 14,
      stochasticPeriod: 14,
      kPeriod: 3,
      dPeriod: 3,
    });

    if (result.length === 0) return null;
    const last = result[result.length - 1];

    return {
      k: last.k,
      d: last.d,
    };
  }
}
