// Frontend types matching backend models

export type AgentStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error'
export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'google' | 'xai'
export type StrategyTemplate = 'momentum' | 'mean_reversion' | 'scalping' | 'breakout' | 'degen' | 'custom'
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
export type TradeAction = 'open_long' | 'open_short' | 'close' | 'hold' | 'reduce'

export interface AgentConfig {
  id: string
  name: string
  userId: string
  llmProvider: LLMProvider
  llmModel: string
  apiKey?: string
  symbol: string
  maxPositionSize: number
  maxLeverage: number
  decisionIntervalMs: number
  strategy: StrategyConfig
  risk: RiskConfig
  status: AgentStatus
  createdAt: number
  updatedAt: number
}

export interface StrategyConfig {
  template: StrategyTemplate
  customPrompt?: string
  timeframes: Timeframe[]
  indicators: string[]
}

export interface RiskConfig {
  maxDrawdownPercent: number
  maxDailyLossPercent: number
  stopLossPercent: number
  takeProfitPercent: number
  maxOpenPositions: number
  cooldownAfterLossMs: number
}

export interface Position {
  id: string
  agentId: string
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  leverage: number
  stopLoss?: number
  takeProfit?: number
  unrealizedPnl: number
  openedAt: number
}

export interface Trade {
  id: string
  agentId: string
  symbol: string
  side: 'long' | 'short'
  action: 'open' | 'close' | 'reduce'
  size: number
  price: number
  leverage: number
  realizedPnl?: number
  fee: number
  reasoning: string
  llmDecision: LLMDecision
  timestamp: number
}

export interface LLMDecision {
  action: TradeAction
  confidence: number
  reasoning: string
  pair: string
  side?: 'long' | 'short'
  entryPrice?: number
  positionSizePercent?: number
  leverage?: number
  stopLoss?: number
  takeProfit?: number
  timeframe?: string
}
