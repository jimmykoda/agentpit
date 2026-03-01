// ============================================
// AgentPit - LLM Router
// Routes requests to the appropriate LLM
// provider (DeepSeek, OpenAI, Anthropic, etc.)
// ============================================

import OpenAI from 'openai';
import { LLMProvider, LLMDecision } from '../types';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const log = createLogger('LLMRouter');

interface LLMRequestOptions {
  provider: LLMProvider;
  model: string;
  apiKey?: string;  // BYOK override
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export class LLMRouter {
  private clients: Map<string, OpenAI> = new Map();

  /**
   * Send a decision request to the specified LLM
   */
  async getDecision(options: LLMRequestOptions): Promise<LLMDecision> {
    const { provider, model, apiKey, systemPrompt, userPrompt, temperature = 0.3, maxTokens = 1000 } = options;

    const client = this.getClient(provider, apiKey);
    const modelName = model || this.getDefaultModel(provider);

    log.info(`Requesting decision from ${provider}/${modelName}`);

    try {
      const startTime = Date.now();

      const response = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });

      const elapsed = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from LLM');
      }

      log.info(`Got response from ${provider} in ${elapsed}ms`);
      log.debug('Raw LLM response', content);

      // Parse and validate the decision
      const decision = this.parseDecision(content);

      // Log token usage
      if (response.usage) {
        log.info(`Tokens used: ${response.usage.prompt_tokens} in / ${response.usage.completion_tokens} out`);
      }

      return decision;
    } catch (err: any) {
      log.error(`LLM request failed (${provider})`, err.message);
      // Return a safe "hold" decision on error
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `LLM error: ${err.message}`,
        pair: '',
      };
    }
  }

  /**
   * Parse and validate the LLM response into a decision
   */
  private parseDecision(raw: string): LLMDecision {
    try {
      // Try to extract JSON from the response (in case LLM wraps it)
      let jsonStr = raw.trim();

      // Handle markdown code blocks
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      const decision: LLMDecision = {
        action: this.validateAction(parsed.action),
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        pair: String(parsed.pair || ''),
        side: parsed.side === 'long' || parsed.side === 'short' ? parsed.side : undefined,
        positionSizePercent: parsed.positionSizePercent ? Number(parsed.positionSizePercent) : undefined,
        leverage: parsed.leverage ? Number(parsed.leverage) : undefined,
        stopLoss: parsed.stopLoss ? Number(parsed.stopLoss) : undefined,
        takeProfit: parsed.takeProfit ? Number(parsed.takeProfit) : undefined,
      };

      return decision;
    } catch (err) {
      log.error('Failed to parse LLM decision', raw);
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `Failed to parse LLM response: ${raw.substring(0, 200)}`,
        pair: '',
      };
    }
  }

  private validateAction(action: any): LLMDecision['action'] {
    const valid = ['open_long', 'open_short', 'close', 'hold', 'reduce'];
    return valid.includes(action) ? action : 'hold';
  }

  /**
   * Get or create an OpenAI-compatible client for the provider
   */
  private getClient(provider: LLMProvider, apiKeyOverride?: string): OpenAI {
    const cacheKey = `${provider}:${apiKeyOverride || 'default'}`;

    if (this.clients.has(cacheKey)) {
      return this.clients.get(cacheKey)!;
    }

    const { apiKey, baseURL } = this.getProviderConfig(provider, apiKeyOverride);

    const client = new OpenAI({ apiKey, baseURL });
    this.clients.set(cacheKey, client);
    return client;
  }

  /**
   * Get provider-specific configuration
   */
  private getProviderConfig(provider: LLMProvider, apiKeyOverride?: string): { apiKey: string; baseURL: string } {
    switch (provider) {
      case 'deepseek':
        return {
          apiKey: apiKeyOverride || config.llm.deepseek.apiKey,
          baseURL: config.llm.deepseek.baseUrl,
        };
      case 'openai':
        return {
          apiKey: apiKeyOverride || config.llm.openai.apiKey,
          baseURL: 'https://api.openai.com/v1',
        };
      case 'anthropic':
        // Anthropic via OpenAI-compatible endpoint
        return {
          apiKey: apiKeyOverride || config.llm.anthropic.apiKey,
          baseURL: 'https://api.anthropic.com/v1',
        };
      case 'google':
        return {
          apiKey: apiKeyOverride || '',
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        };
      case 'xai':
        return {
          apiKey: apiKeyOverride || '',
          baseURL: 'https://api.x.ai/v1',
        };
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }

  private getDefaultModel(provider: LLMProvider): string {
    switch (provider) {
      case 'deepseek': return config.llm.deepseek.model;
      case 'openai': return config.llm.openai.model;
      case 'anthropic': return config.llm.anthropic.model;
      case 'google': return 'gemini-2.0-flash';
      case 'xai': return 'grok-2';
      default: return 'deepseek-chat';
    }
  }
}
