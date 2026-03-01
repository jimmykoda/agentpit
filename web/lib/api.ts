// Mock API Layer for AgentPit Frontend
// This will be replaced with real API calls later

import { AgentConfig, Trade, Position, LLMDecision } from './types'

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Mock user's agents
const mockAgents: AgentConfig[] = [
  {
    id: 'agent-1',
    name: 'Momentum Hunter',
    userId: 'user-1',
    llmProvider: 'deepseek',
    llmModel: 'deepseek-chat',
    symbol: 'BTC-PERP',
    maxPositionSize: 10000,
    maxLeverage: 5,
    decisionIntervalMs: 60000,
    strategy: {
      template: 'momentum',
      timeframes: ['1m', '5m', '15m'],
      indicators: ['rsi', 'macd', 'ema'],
    },
    risk: {
      maxDrawdownPercent: 15,
      maxDailyLossPercent: 10,
      stopLossPercent: 3,
      takeProfitPercent: 5,
      maxOpenPositions: 2,
      cooldownAfterLossMs: 300000,
    },
    status: 'running',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'agent-2',
    name: 'Mean Reversion Pro',
    userId: 'user-1',
    llmProvider: 'openai',
    llmModel: 'gpt-4o',
    symbol: 'ETH-PERP',
    maxPositionSize: 5000,
    maxLeverage: 3,
    decisionIntervalMs: 300000,
    strategy: {
      template: 'mean_reversion',
      timeframes: ['15m', '1h', '4h'],
      indicators: ['rsi', 'bollingerBands', 'sma'],
    },
    risk: {
      maxDrawdownPercent: 10,
      maxDailyLossPercent: 5,
      stopLossPercent: 2,
      takeProfitPercent: 4,
      maxOpenPositions: 1,
      cooldownAfterLossMs: 600000,
    },
    status: 'paused',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 1800000,
  },
  {
    id: 'agent-3',
    name: 'SOL Scalper',
    userId: 'user-1',
    llmProvider: 'anthropic',
    llmModel: 'claude-3.5-sonnet',
    symbol: 'SOL-PERP',
    maxPositionSize: 3000,
    maxLeverage: 10,
    decisionIntervalMs: 30000,
    strategy: {
      template: 'scalping',
      timeframes: ['1m', '5m'],
      indicators: ['rsi', 'ema', 'volume'],
    },
    risk: {
      maxDrawdownPercent: 20,
      maxDailyLossPercent: 15,
      stopLossPercent: 1,
      takeProfitPercent: 2,
      maxOpenPositions: 3,
      cooldownAfterLossMs: 60000,
    },
    status: 'running',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 600000,
  },
]

// Mock positions
const mockPositions: Record<string, Position | null> = {
  'agent-1': {
    id: 'pos-1',
    agentId: 'agent-1',
    symbol: 'BTC-PERP',
    side: 'long',
    size: 0.15,
    entryPrice: 94500,
    leverage: 5,
    stopLoss: 91665,
    takeProfit: 99225,
    unrealizedPnl: 0,
    openedAt: Date.now() - 3600000,
  },
  'agent-2': null,
  'agent-3': {
    id: 'pos-3',
    agentId: 'agent-3',
    symbol: 'SOL-PERP',
    side: 'short',
    size: 50,
    entryPrice: 145.2,
    leverage: 10,
    stopLoss: 147.65,
    takeProfit: 142.75,
    unrealizedPnl: 0,
    openedAt: Date.now() - 900000,
  },
}

// Mock trades
const mockTrades: Record<string, Trade[]> = {
  'agent-1': [
    {
      id: 'trade-1',
      agentId: 'agent-1',
      symbol: 'BTC-PERP',
      side: 'long',
      action: 'open',
      size: 0.15,
      price: 94500,
      leverage: 5,
      fee: 14.18,
      reasoning: 'Strong momentum confirmed by RSI divergence and MACD crossover. Entry at support level.',
      llmDecision: {
        action: 'open_long',
        confidence: 82,
        reasoning: 'Strong momentum confirmed by RSI divergence and MACD crossover. Entry at support level.',
        pair: 'BTC-PERP',
        side: 'long',
        entryPrice: 94500,
        positionSizePercent: 50,
        leverage: 5,
        stopLoss: 91665,
        takeProfit: 99225,
      },
      timestamp: Date.now() - 3600000,
    },
    {
      id: 'trade-2',
      agentId: 'agent-1',
      symbol: 'BTC-PERP',
      side: 'long',
      action: 'close',
      size: 0.10,
      price: 96800,
      leverage: 5,
      realizedPnl: 1150,
      fee: 14.52,
      reasoning: 'Take profit hit, securing gains before potential reversal.',
      llmDecision: {
        action: 'close',
        confidence: 75,
        reasoning: 'Take profit hit, securing gains before potential reversal.',
        pair: 'BTC-PERP',
      },
      timestamp: Date.now() - 7200000,
    },
  ],
  'agent-2': [
    {
      id: 'trade-3',
      agentId: 'agent-2',
      symbol: 'ETH-PERP',
      side: 'long',
      action: 'close',
      size: 2.5,
      price: 2420,
      leverage: 3,
      realizedPnl: -125.50,
      fee: 18.15,
      reasoning: 'Stop loss triggered due to trend reversal.',
      llmDecision: {
        action: 'close',
        confidence: 90,
        reasoning: 'Stop loss triggered due to trend reversal.',
        pair: 'ETH-PERP',
      },
      timestamp: Date.now() - 86400000,
    },
  ],
  'agent-3': [
    {
      id: 'trade-4',
      agentId: 'agent-3',
      symbol: 'SOL-PERP',
      side: 'short',
      action: 'open',
      size: 50,
      price: 145.2,
      leverage: 10,
      fee: 72.60,
      reasoning: 'Overbought conditions on 1m chart, quick scalp opportunity.',
      llmDecision: {
        action: 'open_short',
        confidence: 78,
        reasoning: 'Overbought conditions on 1m chart, quick scalp opportunity.',
        pair: 'SOL-PERP',
        side: 'short',
        entryPrice: 145.2,
        positionSizePercent: 30,
        leverage: 10,
        stopLoss: 147.65,
        takeProfit: 142.75,
      },
      timestamp: Date.now() - 900000,
    },
  ],
}

// Mock decisions
const mockDecisions: Record<string, LLMDecision[]> = {
  'agent-1': [
    {
      action: 'hold',
      confidence: 65,
      reasoning: 'Market consolidating, waiting for clearer directional signal. RSI neutral, MACD showing slight bearish divergence.',
      pair: 'BTC-PERP',
    },
    {
      action: 'hold',
      confidence: 70,
      reasoning: 'Current position showing profit, monitoring for exit signal. Volume declining, suggesting continuation.',
      pair: 'BTC-PERP',
    },
  ],
  'agent-2': [],
  'agent-3': [
    {
      action: 'reduce',
      confidence: 72,
      reasoning: 'Taking partial profits, price nearing target. Reducing risk ahead of potential support level.',
      pair: 'SOL-PERP',
      side: 'short',
    },
  ],
}

// Mock leaderboard data
const mockLeaderboard = [
  {
    id: 'agent-leader-1',
    name: 'Alpha Seeker',
    userId: 'user-5',
    strategy: 'momentum',
    model: 'gpt-4o',
    totalPnl: 15420.50,
    winRate: 68.5,
    totalTrades: 247,
    sharpeRatio: 2.4,
  },
  {
    id: 'agent-leader-2',
    name: 'Volatility Master',
    userId: 'user-12',
    strategy: 'breakout',
    model: 'claude-3.5-sonnet',
    totalPnl: 12890.25,
    winRate: 64.2,
    totalTrades: 189,
    sharpeRatio: 2.1,
  },
  {
    id: 'agent-1',
    name: 'Momentum Hunter',
    userId: 'user-1',
    strategy: 'momentum',
    model: 'deepseek-chat',
    totalPnl: 8765.75,
    winRate: 61.8,
    totalTrades: 156,
    sharpeRatio: 1.8,
  },
  {
    id: 'agent-leader-3',
    name: 'Mean Reversion Bot',
    userId: 'user-8',
    strategy: 'mean_reversion',
    model: 'gpt-4o-mini',
    totalPnl: 6543.10,
    winRate: 59.3,
    totalTrades: 203,
    sharpeRatio: 1.6,
  },
  {
    id: 'agent-3',
    name: 'SOL Scalper',
    userId: 'user-1',
    strategy: 'scalping',
    model: 'claude-3.5-sonnet',
    totalPnl: 4321.00,
    winRate: 55.7,
    totalTrades: 412,
    sharpeRatio: 1.4,
  },
]

// API Functions
export const api = {
  // Get all user's agents
  async getAgents(): Promise<AgentConfig[]> {
    await delay(300)
    return [...mockAgents]
  },

  // Get single agent by ID
  async getAgent(id: string): Promise<AgentConfig | null> {
    await delay(200)
    return mockAgents.find(a => a.id === id) || null
  },

  // Get agent's current position
  async getAgentPosition(id: string): Promise<Position | null> {
    await delay(150)
    return mockPositions[id] || null
  },

  // Get agent's trade history
  async getAgentTrades(id: string): Promise<Trade[]> {
    await delay(250)
    return mockTrades[id] || []
  },

  // Get agent's recent decisions
  async getAgentDecisions(id: string): Promise<LLMDecision[]> {
    await delay(200)
    return mockDecisions[id] || []
  },

  // Create new agent
  async createAgent(config: Partial<AgentConfig>): Promise<AgentConfig> {
    await delay(500)
    const newAgent: AgentConfig = {
      id: `agent-${Date.now()}`,
      name: config.name || 'New Agent',
      userId: 'user-1',
      llmProvider: config.llmProvider || 'deepseek',
      llmModel: config.llmModel || 'deepseek-chat',
      symbol: config.symbol || 'BTC-PERP',
      maxPositionSize: config.maxPositionSize || 5000,
      maxLeverage: config.maxLeverage || 5,
      decisionIntervalMs: config.decisionIntervalMs || 60000,
      strategy: config.strategy || {
        template: 'momentum',
        timeframes: ['1m', '5m', '15m'],
        indicators: ['rsi', 'macd', 'ema'],
      },
      risk: config.risk || {
        maxDrawdownPercent: 15,
        maxDailyLossPercent: 10,
        stopLossPercent: 3,
        takeProfitPercent: 5,
        maxOpenPositions: 2,
        cooldownAfterLossMs: 300000,
      },
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    mockAgents.push(newAgent)
    return newAgent
  },

  // Start agent
  async startAgent(id: string): Promise<void> {
    await delay(300)
    const agent = mockAgents.find(a => a.id === id)
    if (agent) {
      agent.status = 'running'
      agent.updatedAt = Date.now()
    }
  },

  // Stop agent
  async stopAgent(id: string): Promise<void> {
    await delay(300)
    const agent = mockAgents.find(a => a.id === id)
    if (agent) {
      agent.status = 'stopped'
      agent.updatedAt = Date.now()
    }
  },

  // Pause agent
  async pauseAgent(id: string): Promise<void> {
    await delay(300)
    const agent = mockAgents.find(a => a.id === id)
    if (agent) {
      agent.status = 'paused'
      agent.updatedAt = Date.now()
    }
  },

  // Get leaderboard
  async getLeaderboard(): Promise<typeof mockLeaderboard> {
    await delay(400)
    return [...mockLeaderboard]
  },

  // Get account summary
  async getAccountSummary() {
    await delay(250)
    const totalAgents = mockAgents.length
    const activeAgents = mockAgents.filter(a => a.status === 'running').length
    return {
      totalAgents,
      activeAgents,
      totalPnl: 0,
      accountBalance: 0,
      dailyPnl: 0,
      weeklyPnl: 0,
    }
  },
}
