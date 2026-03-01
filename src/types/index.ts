// ============================================
// AgentPit - Core Type Definitions
// ============================================

// --- Market Data Types ---

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBook {
  bids: [number, number][]; // [price, size]
  asks: [number, number][]; // [price, size]
  timestamp: number;
}

export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume24h: number;
  change24h: number;
  high24h: number;
  low24h: number;
  fundingRate: number;
  openInterest: number;
  timestamp: number;
}

// --- Indicator Types ---

export interface Indicators {
  rsi: number | null;
  macd: MACDResult | null;
  bollingerBands: BollingerBandResult | null;
  ema: {
    ema9: number | null;
    ema21: number | null;
    ema50: number | null;
    ema200: number | null;
  };
  sma: {
    sma20: number | null;
    sma50: number | null;
  };
  atr: number | null;
  volume: {
    current: number;
    average: number;
    ratio: number;
  };
  stochRSI: StochRSIResult | null;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

export interface StochRSIResult {
  k: number;
  d: number;
}

// --- Agent Types ---

export type AgentStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export interface AgentConfig {
  id: string;
  name: string;
  userId: string;

  // LLM config
  llmProvider: LLMProvider;
  llmModel: string;
  apiKey?: string; // BYOK - encrypted at rest

  // Trading config
  symbol: string;
  maxPositionSize: number;      // max position in USD
  maxLeverage: number;          // 1-50x
  decisionIntervalMs: number;   // how often to evaluate (ms)

  // Strategy
  strategy: StrategyConfig;

  // Risk management
  risk: RiskConfig;

  // State
  status: AgentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface StrategyConfig {
  template: StrategyTemplate;
  customPrompt?: string;        // user can add custom instructions
  timeframes: Timeframe[];      // which timeframes to analyze
  indicators: string[];         // which indicators to use
}

export type StrategyTemplate =
  | 'momentum'        // trend following
  | 'mean_reversion'  // buy dips, sell rips
  | 'scalping'        // quick in/out
  | 'breakout'        // trade breakouts
  | 'degen'           // high leverage, high risk, YOLO
  | 'custom';         // user-defined

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface RiskConfig {
  maxDrawdownPercent: number;    // max drawdown before stopping (e.g. 20%)
  maxDailyLossPercent: number;   // max loss per day
  stopLossPercent: number;       // default stop loss per trade
  takeProfitPercent: number;     // default take profit per trade
  maxOpenPositions: number;      // max concurrent positions
  cooldownAfterLossMs: number;   // wait time after a losing trade
}

// --- LLM Types ---

export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'google' | 'xai';

export interface LLMDecision {
  action: TradeAction;
  confidence: number;           // 0-100
  reasoning: string;
  pair: string;
  side?: 'long' | 'short';
  entryPrice?: number;
  positionSizePercent?: number; // % of available capital
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeframe?: string;
}

export type TradeAction = 'open_long' | 'open_short' | 'close' | 'hold' | 'reduce';

// --- Trade Types ---

export interface Position {
  id: string;
  agentId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnl: number;
  openedAt: number;
}

export interface Trade {
  id: string;
  agentId: string;
  symbol: string;
  side: 'long' | 'short';
  action: 'open' | 'close' | 'reduce';
  size: number;
  price: number;
  leverage: number;
  realizedPnl?: number;
  fee: number;
  reasoning: string;
  llmDecision: LLMDecision;
  timestamp: number;
}

// --- Market Context (sent to LLM) ---

export interface MarketContext {
  symbol: string;
  currentPrice: number;
  ticker: MarketTicker;
  indicators: Record<Timeframe, Indicators>;
  recentCandles: OHLCV[];
  orderBook: {
    topBids: [number, number][];
    topAsks: [number, number][];
    spread: number;
    spreadPercent: number;
  };
  currentPosition: Position | null;
  recentTrades: Trade[];
  accountBalance: number;
  timestamp: number;
}

// --- Events ---

export type AgentEvent =
  | { type: 'decision'; agentId: string; decision: LLMDecision; timestamp: number }
  | { type: 'trade'; agentId: string; trade: Trade; timestamp: number }
  | { type: 'error'; agentId: string; error: string; timestamp: number }
  | { type: 'status_change'; agentId: string; from: AgentStatus; to: AgentStatus; timestamp: number }
  | { type: 'risk_alert'; agentId: string; alert: string; timestamp: number };
