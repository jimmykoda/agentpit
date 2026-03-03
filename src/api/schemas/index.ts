// ============================================
// AgentPit - Request/Response Validation Schemas
// ============================================

import { z } from 'zod';

// --- Auth ---

export const NonceRequestSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

export const VerifySignatureSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string(),
  nonce: z.string(),
});

// --- Agents ---

export const CreateAgentSchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(20),
  llmProvider: z.enum(['deepseek', 'openai', 'anthropic', 'google', 'xai']).default('deepseek'),
  llmModel: z.string().optional(),
  maxPositionSize: z.number().min(10).max(1_000_000).default(1000),
  maxLeverage: z.number().min(1).max(50).default(10),
  decisionIntervalMs: z.number().min(30_000).max(86_400_000).default(300_000),
  strategy: z.object({
    template: z.enum([
      'momentum', 'mean_reversion', 'scalping', 'breakout', 'degen',
      'ict_scalper', 'smart_money_swing', 'fibonacci_trader', 'wyckoff',
      'sr_bounce', 'custom',
    ]),
    customPrompt: z.string().max(2000).optional(),
    timeframes: z.array(z.enum(['1m', '5m', '15m', '1h', '4h', '1d'])).min(1).max(6),
    indicators: z.array(z.string()).min(1),
  }),
  risk: z.object({
    maxDrawdownPercent: z.number().min(1).max(100).default(20),
    maxDailyLossPercent: z.number().min(1).max(100).default(10),
    stopLossPercent: z.number().min(0.1).max(50).default(5),
    takeProfitPercent: z.number().min(0.1).max(100).default(10),
    maxOpenPositions: z.number().min(1).max(20).default(3),
    cooldownAfterLossMs: z.number().min(0).max(3_600_000).default(60_000),
  }).optional(),
});

export const UpdateAgentSchema = CreateAgentSchema.partial();

export const AgentIdParamSchema = z.object({
  agentId: z.string().uuid(),
});

// --- API Keys (BYOK) ---

export const StoreApiKeySchema = z.object({
  provider: z.enum(['deepseek', 'openai', 'anthropic', 'google', 'xai']),
  apiKey: z.string().min(10).max(512),
});

// --- Query Params ---

export const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const TradeQuerySchema = PaginationSchema.extend({
  symbol: z.string().optional(),
  side: z.enum(['long', 'short']).optional(),
  action: z.enum(['open', 'close', 'reduce']).optional(),
});

export const EventQuerySchema = PaginationSchema.extend({
  type: z.enum(['decision', 'trade', 'error', 'status_change', 'risk_alert']).optional(),
});

// --- Types ---

export type NonceRequest = z.infer<typeof NonceRequestSchema>;
export type VerifySignatureRequest = z.infer<typeof VerifySignatureSchema>;
export type CreateAgentRequest = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentRequest = z.infer<typeof UpdateAgentSchema>;
export type StoreApiKeyRequest = z.infer<typeof StoreApiKeySchema>;
