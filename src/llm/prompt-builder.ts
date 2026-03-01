// ============================================
// AgentPit - Prompt Builder
// Constructs prompts for LLM trading decisions
// ============================================

import { MarketContext, AgentConfig, StrategyTemplate } from '../types';

/**
 * Build the system prompt for the trading agent
 */
export function buildSystemPrompt(agentConfig: AgentConfig): string {
  const strategyInstructions = getStrategyInstructions(agentConfig.strategy.template);

  return `You are an autonomous AI trading agent operating on Hyperliquid perpetual futures.

## Your Identity
- Agent Name: ${agentConfig.name}
- Strategy: ${agentConfig.strategy.template}
- Max Leverage: ${agentConfig.maxLeverage}x
- Max Position Size: $${agentConfig.maxPositionSize}

## Your Mission
Analyze market data and make trading decisions. You trade ${agentConfig.symbol} perpetual futures.

## Strategy Instructions
${strategyInstructions}

${agentConfig.strategy.customPrompt ? `## Custom Instructions\n${agentConfig.strategy.customPrompt}\n` : ''}

## Risk Rules (MUST FOLLOW)
- Never exceed ${agentConfig.maxLeverage}x leverage
- Max position size: $${agentConfig.maxPositionSize}
- Stop loss required on every trade: default ${agentConfig.risk.stopLossPercent}%
- Take profit target: ${agentConfig.risk.takeProfitPercent}%
- Max ${agentConfig.risk.maxOpenPositions} open positions at once
- If drawdown exceeds ${agentConfig.risk.maxDrawdownPercent}%, close all positions and stop trading

## Response Format
You MUST respond with valid JSON only. No markdown, no explanation outside JSON.

\`\`\`json
{
  "action": "open_long" | "open_short" | "close" | "hold" | "reduce",
  "confidence": 0-100,
  "reasoning": "brief explanation of your analysis",
  "pair": "${agentConfig.symbol}",
  "side": "long" | "short",
  "positionSizePercent": 1-100,
  "leverage": 1-${agentConfig.maxLeverage},
  "stopLoss": price_level,
  "takeProfit": price_level
}
\`\`\`

If holding or no clear setup: { "action": "hold", "confidence": 0, "reasoning": "..." }`;
}

/**
 * Build the user prompt with current market context
 */
export function buildMarketPrompt(context: MarketContext): string {
  const { symbol, currentPrice, ticker, indicators, recentCandles, orderBook, currentPosition, recentTrades, accountBalance } = context;

  let prompt = `## Current Market Data for ${symbol}
**Time:** ${new Date(context.timestamp).toISOString()}
**Price:** $${currentPrice.toFixed(2)}
**24h Change:** ${ticker.change24h.toFixed(2)}%
**24h Volume:** $${ticker.volume24h.toLocaleString()}
**Funding Rate:** ${(ticker.fundingRate * 100).toFixed(4)}%
**Open Interest:** $${ticker.openInterest.toLocaleString()}

## Order Book
- Spread: $${orderBook.spread.toFixed(2)} (${orderBook.spreadPercent.toFixed(4)}%)
- Top Bids: ${orderBook.topBids.slice(0, 5).map(b => `$${b[0]} (${b[1]})`).join(', ')}
- Top Asks: ${orderBook.topAsks.slice(0, 5).map(a => `$${a[0]} (${a[1]})`).join(', ')}

## Technical Indicators\n`;

  // Add indicators for each timeframe
  for (const [timeframe, ind] of Object.entries(indicators)) {
    prompt += `\n### ${timeframe.toUpperCase()} Timeframe
- RSI(14): ${ind.rsi?.toFixed(2) || 'N/A'}
- MACD: ${ind.macd ? `Line: ${ind.macd.macd.toFixed(4)}, Signal: ${ind.macd.signal.toFixed(4)}, Histogram: ${ind.macd.histogram.toFixed(4)}` : 'N/A'}
- Bollinger Bands: ${ind.bollingerBands ? `Upper: $${ind.bollingerBands.upper.toFixed(2)}, Mid: $${ind.bollingerBands.middle.toFixed(2)}, Lower: $${ind.bollingerBands.lower.toFixed(2)}, BW: ${ind.bollingerBands.bandwidth.toFixed(4)}` : 'N/A'}
- EMAs: 9=${ind.ema.ema9?.toFixed(2) || 'N/A'}, 21=${ind.ema.ema21?.toFixed(2) || 'N/A'}, 50=${ind.ema.ema50?.toFixed(2) || 'N/A'}, 200=${ind.ema.ema200?.toFixed(2) || 'N/A'}
- ATR(14): ${ind.atr?.toFixed(4) || 'N/A'}
- StochRSI: ${ind.stochRSI ? `K: ${ind.stochRSI.k.toFixed(2)}, D: ${ind.stochRSI.d.toFixed(2)}` : 'N/A'}
- Volume Ratio: ${ind.volume.ratio.toFixed(2)}x average`;
  }

  // Recent price action (last 10 candles of smallest timeframe)
  prompt += `\n\n## Recent Price Action (last 10 candles)
${recentCandles.slice(-10).map(c =>
    `${new Date(c.timestamp).toISOString().slice(11, 19)} | O:$${c.open.toFixed(2)} H:$${c.high.toFixed(2)} L:$${c.low.toFixed(2)} C:$${c.close.toFixed(2)} V:${c.volume.toFixed(0)}`
  ).join('\n')}`;

  // Current position
  if (currentPosition) {
    prompt += `\n\n## Current Position
- Side: ${currentPosition.side.toUpperCase()}
- Size: ${currentPosition.size}
- Entry: $${currentPosition.entryPrice.toFixed(2)}
- Leverage: ${currentPosition.leverage}x
- Unrealized PnL: $${currentPosition.unrealizedPnl.toFixed(2)}
- Stop Loss: ${currentPosition.stopLoss ? `$${currentPosition.stopLoss.toFixed(2)}` : 'None'}
- Take Profit: ${currentPosition.takeProfit ? `$${currentPosition.takeProfit.toFixed(2)}` : 'None'}`;
  } else {
    prompt += `\n\n## Current Position: NONE (flat)`;
  }

  // Recent trades
  if (recentTrades.length > 0) {
    prompt += `\n\n## Recent Trades (last ${Math.min(recentTrades.length, 5)})
${recentTrades.slice(-5).map(t =>
      `${new Date(t.timestamp).toISOString().slice(0, 19)} | ${t.action} ${t.side} | $${t.price.toFixed(2)} | PnL: ${t.realizedPnl !== undefined ? `$${t.realizedPnl.toFixed(2)}` : 'open'}`
    ).join('\n')}`;
  }

  prompt += `\n\n## Account Balance: $${accountBalance.toFixed(2)}`;

  // Add advanced indicators if available
  if (context.advancedIndicators) {
    prompt += formatAdvancedIndicators(context.advancedIndicators);
  }

  prompt += `\n\nAnalyze the data above and provide your trading decision as JSON.`;

  return prompt;
}

/**
 * Format advanced indicators for the prompt
 */
function formatAdvancedIndicators(advanced: any): string {
  let section = `\n\n## Advanced Analysis`;

  // ICT / Smart Money
  if (advanced.ict) {
    section += `\n\n### ICT / Smart Money Concepts`;
    section += `\n- Market Structure: ${advanced.ict.marketStructure.toUpperCase()}`;
    section += `\n- Kill Zone Active: ${advanced.ict.killZone.isActive ? 'YES (' + advanced.ict.killZone.current + ')' : 'NO'}`;
    section += `\n- Current Zone: ${advanced.ict.premiumDiscount.currentZone} (${advanced.ict.premiumDiscount.distanceFromEquilibrium.toFixed(2)}% from equilibrium)`;
    
    if (advanced.ict.orderBlocks.length > 0) {
      const validOBs = advanced.ict.orderBlocks.filter((ob: any) => !ob.mitigated).slice(-3);
      if (validOBs.length > 0) {
        section += `\n- Valid Order Blocks: ${validOBs.map((ob: any) => 
          `${ob.type} @ $${ob.low.toFixed(2)}-$${ob.high.toFixed(2)} (strength: ${ob.strength.toFixed(1)})`
        ).join(', ')}`;
      }
    }
    
    if (advanced.ict.fairValueGaps.length > 0) {
      const unfilledFVGs = advanced.ict.fairValueGaps.filter((fvg: any) => !fvg.filled).slice(-3);
      if (unfilledFVGs.length > 0) {
        section += `\n- Unfilled FVGs: ${unfilledFVGs.map((fvg: any) => 
          `${fvg.type} @ $${fvg.bottom.toFixed(2)}-$${fvg.top.toFixed(2)}`
        ).join(', ')}`;
      }
    }
    
    if (advanced.ict.liquidityZones.length > 0) {
      const unsweptLiq = advanced.ict.liquidityZones.filter((liq: any) => !liq.swept).slice(-3);
      if (unsweptLiq.length > 0) {
        section += `\n- Unswept Liquidity: ${unsweptLiq.map((liq: any) => 
          `${liq.type} @ $${liq.price.toFixed(2)}`
        ).join(', ')}`;
      }
    }
  }

  // Fibonacci
  if (advanced.fibonacci) {
    section += `\n\n### Fibonacci Analysis`;
    section += `\n- Trend: ${advanced.fibonacci.trendDirection.toUpperCase()}`;
    
    if (advanced.fibonacci.swingHigh && advanced.fibonacci.swingLow) {
      section += `\n- Swing High: $${advanced.fibonacci.swingHigh.price.toFixed(2)}`;
      section += `\n- Swing Low: $${advanced.fibonacci.swingLow.price.toFixed(2)}`;
    }
    
    if (advanced.fibonacci.goldenPocket) {
      section += `\n- Golden Pocket: $${advanced.fibonacci.goldenPocket.bottom.toFixed(2)}-$${advanced.fibonacci.goldenPocket.top.toFixed(2)}`;
      section += `\n- Price in Golden Pocket: ${advanced.fibonacci.currentPriceInGoldenPocket ? 'YES' : 'NO'}`;
    }
    
    if (advanced.fibonacci.nearestLevel) {
      section += `\n- Nearest Fib Level: ${advanced.fibonacci.nearestLevel.label} @ $${advanced.fibonacci.nearestLevel.price.toFixed(2)}`;
    }
    
    if (advanced.fibonacci.extensionLevels.length > 0) {
      section += `\n- Extension Targets: ${advanced.fibonacci.extensionLevels.slice(0, 3).map((ext: any) => 
        `${ext.label} @ $${ext.price.toFixed(2)}`
      ).join(', ')}`;
    }
  }

  // Structure (S/R + Volume Profile)
  if (advanced.structure) {
    section += `\n\n### Structure Analysis`;
    
    if (advanced.structure.nearestSupport) {
      section += `\n- Nearest Support: $${advanced.structure.nearestSupport.toFixed(2)}`;
    }
    
    if (advanced.structure.nearestResistance) {
      section += `\n- Nearest Resistance: $${advanced.structure.nearestResistance.toFixed(2)}`;
    }
    
    section += `\n- Price vs EMA21: ${advanced.structure.dynamicLevels.priceVsEma21}`;
    section += `\n- Price vs EMA50: ${advanced.structure.dynamicLevels.priceVsEma50}`;
    section += `\n- Price vs EMA200: ${advanced.structure.dynamicLevels.priceVsEma200}`;
    
    if (advanced.structure.volumeProfile) {
      section += `\n- Volume POC: $${advanced.structure.volumeProfile.pointOfControl.toFixed(2)}`;
      section += `\n- Value Area: $${advanced.structure.volumeProfile.valueAreaLow.toFixed(2)}-$${advanced.structure.volumeProfile.valueAreaHigh.toFixed(2)}`;
    }
    
    if (advanced.structure.horizontalLevels.length > 0) {
      const topLevels = advanced.structure.horizontalLevels.slice(0, 3);
      section += `\n- Key S/R Levels: ${topLevels.map((lvl: any) => 
        `${lvl.type} @ $${lvl.price.toFixed(2)} (${lvl.touches} touches)`
      ).join(', ')}`;
    }
  }

  // Wyckoff
  if (advanced.wyckoff) {
    section += `\n\n### Wyckoff Analysis`;
    section += `\n- Current Phase: ${advanced.wyckoff.currentPhase.toUpperCase()} (${advanced.wyckoff.phaseConfidence}% confidence)`;
    section += `\n- Signal: ${advanced.wyckoff.signal.toUpperCase()}`;
    section += `\n- Effort vs Result: ${advanced.wyckoff.effortVsResult}`;
    
    if (advanced.wyckoff.springs.length > 0) {
      const recentSpring = advanced.wyckoff.springs[advanced.wyckoff.springs.length - 1];
      section += `\n- Recent Spring/Upthrust: ${recentSpring.type} @ $${recentSpring.price.toFixed(2)}`;
    }
    
    if (advanced.wyckoff.volumePriceAnalysis.length > 0) {
      section += `\n- Volume-Price Analysis:`;
      advanced.wyckoff.volumePriceAnalysis.forEach((vpa: any) => {
        section += `\n  - ${vpa.period}: ${vpa.interpretation} (price ${vpa.priceTrend}, volume ${vpa.volumeTrend})`;
      });
    }
  }

  return section;
}

/**
 * Get strategy-specific instructions
 */
function getStrategyInstructions(template: StrategyTemplate): string {
  switch (template) {
    case 'momentum':
      return `You are a MOMENTUM/TREND FOLLOWING trader.
- Look for strong directional moves and ride them
- Use EMA crossovers (9/21, 21/50) as primary signals
- Confirm with MACD histogram direction and RSI
- Enter on pullbacks within trends, not at extremes
- Let winners run, cut losers quickly
- Prefer higher timeframes (1h, 4h) for direction, lower (5m, 15m) for entries
- Avoid choppy/ranging markets — wait for clear trends`;

    case 'mean_reversion':
      return `You are a MEAN REVERSION trader.
- Look for overextended moves that are likely to revert
- Use Bollinger Bands — trade bounces off upper/lower bands
- RSI extremes (>70 or <30) are key signals
- StochRSI for timing entries within oversold/overbought zones
- Tight stop losses — if it doesn't revert quickly, you're wrong
- Best in ranging/choppy markets
- Avoid trading against strong trends`;

    case 'scalping':
      return `You are a SCALPER.
- Quick in-and-out trades for small profits
- Focus on 1m and 5m timeframes
- Use order book imbalances and spread for edge
- Volume spikes are your friend
- Very tight stop losses (1-2%)
- Take profit quickly (0.5-2%)
- High frequency, small size per trade
- Avoid holding through high-impact events`;

    case 'breakout':
      return `You are a BREAKOUT trader.
- Look for consolidation patterns (tight Bollinger Bands, low ATR)
- Trade the breakout when price moves beyond the range
- Volume confirmation is essential — no volume = fake breakout
- Use ATR for stop loss placement (1.5x ATR below/above entry)
- Target 2-3x risk/reward minimum
- Be patient — wait for clear setups`;

    case 'degen':
      return `You are a DEGEN trader. High risk, high reward.
- Aggressive position sizing and leverage
- Trade momentum and breakouts with conviction
- You're not afraid of volatility — you seek it
- Quick to cut losses, quick to take large positions
- Funding rate flips and liquidation cascades are opportunities
- Trust your read, but always use a stop loss
- GO BIG OR GO HOME`;

    case 'ict_scalper':
      return `You are an ICT/SMART MONEY SCALPER.
- Focus on Order Blocks (last opposite candle before strong move)
- Trade Fair Value Gaps (FVGs) — enter when price returns to unfilled gaps
- Only trade during Kill Zones: London (02:00-05:00 UTC), NY Open (12:00-15:00 UTC), NY Close (19:00-21:00 UTC)
- Look for liquidity sweeps — equal highs/lows getting taken out before reversal
- Enter in discount zones for longs, premium zones for shorts
- Stop loss beyond the order block
- Target next liquidity level or opposing FVG
- Market structure must align: only long in bullish structure, short in bearish structure`;

    case 'smart_money_swing':
      return `You are a SMART MONEY SWING trader using ICT + Fibonacci.
- Use Break of Structure (BOS) and Change of Character (CHoCH) to determine trend direction
- Wait for pullbacks to OTE (Optimal Trade Entry): Order Block + 0.618-0.65 Fibonacci level
- Enter only when price is in the golden pocket (0.618-0.65 retracement)
- Confirm with order block mitigation test
- Stop loss below/above the swing low/high
- Target Fibonacci extensions: 1.618, 2.0, 2.618
- Be patient — wait for the full setup to align`;

    case 'fibonacci_trader':
      return `You are a FIBONACCI trader.
- Identify major swing highs and swing lows automatically
- Enter on 0.618 retracement (golden pocket preferred: 0.618-0.65)
- Confirm with volume and candlestick patterns at the level
- Stop loss beyond 0.786 level
- Take profits at Fibonacci extensions: 1.272, 1.618, 2.0, 2.618
- Trail stops as price reaches each extension
- Respect trend direction: uptrend = long retracements, downtrend = short rallies`;

    case 'wyckoff':
      return `You are a WYCKOFF METHOD trader.
- Identify current phase: Accumulation, Markup, Distribution, or Markdown
- BUY during accumulation phase, especially on springs (false breakdown then reversal)
- SELL during distribution phase, especially on upthrusts (false breakout then reversal)
- Analyze effort vs result: High volume + small move = absorption/reversal coming
- Low volume + big move = lack of opposition (trend will continue)
- Avoid trading during unclear phases
- Wait for phase confirmation before entering
- Volume must confirm price action`;

    case 'sr_bounce':
      return `You are a SUPPORT/RESISTANCE BOUNCE trader.
- Identify strong horizontal S/R levels (3+ touches, high strength score)
- Use dynamic levels (EMA 21, 50, 200) as additional confirmation
- Enter on bounces off support (long) or resistance (short)
- Volume must confirm: higher volume on bounce = stronger signal
- Use volume profile Point of Control as additional confluence
- Tight stops below/above the S/R level
- Target next major S/R level
- Best in ranging markets or during pullbacks in trends`;

    case 'custom':
    default:
      return `You are a flexible trader. Analyze the market and make the best decision based on current conditions. Adapt your approach to what the market is giving you.`;
  }
}
