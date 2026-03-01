// ============================================
// AgentPit - Configuration
// ============================================

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Hyperliquid
  hyperliquid: {
    wsUrl: process.env.HL_WS_URL || 'wss://api.hyperliquid-testnet.xyz/ws',
    apiUrl: process.env.HL_API_URL || 'https://api.hyperliquid-testnet.xyz',
    privateKey: process.env.HL_PRIVATE_KEY || '',
    isTestnet: process.env.HL_TESTNET !== 'false',
  },

  // Default LLM (DeepSeek)
  llm: {
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    },
  },

  // Redis (for job queues)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Supabase (database)
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },

  // Encryption (for BYOK API keys)
  encryption: {
    masterKey: process.env.ENCRYPTION_KEY || '',
  },

  // Scheduler
  scheduler: {
    concurrency: parseInt(process.env.SCHEDULER_CONCURRENCY || '5', 10),
    maxJobsPerSecond: parseInt(process.env.SCHEDULER_MAX_JOBS_PER_SEC || '10', 10),
  },

  // Agent defaults
  agent: {
    defaultDecisionIntervalMs: 5 * 60 * 1000, // 5 minutes
    defaultMaxLeverage: 10,
    defaultMaxPositionSize: 1000, // USD
    defaultMaxDrawdown: 20,       // %
    defaultMaxDailyLoss: 10,      // %
    defaultStopLoss: 5,           // %
    defaultTakeProfit: 10,        // %
    defaultMaxOpenPositions: 3,
    defaultCooldownMs: 60 * 1000, // 1 min after loss
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};
