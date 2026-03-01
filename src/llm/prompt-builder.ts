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
  prompt += `\n\nAnalyze the data above and provide your trading decision as JSON.`;

  return prompt;
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

    case 'custom':
    default:
      return `You are a flexible trader. Analyze the market and make the best decision based on current conditions. Adapt your approach to what the market is giving you.`;
  }
}
