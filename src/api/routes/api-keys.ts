// ============================================
// AgentPit - API Key Routes (BYOK)
// ============================================

import { FastifyInstance } from 'fastify';
import { StoreApiKeySchema } from '../schemas';
import { authGuard, getUserId } from '../middleware/auth';
import { ApiKeyRepository } from '../../db/repositories/api-keys';
import { createLogger } from '../../utils/logger';

const log = createLogger('ApiKeyRoutes');

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  const apiKeyRepo = new ApiKeyRepository();

  app.addHook('preHandler', authGuard);

  /**
   * GET /api-keys
   * List stored providers (not the keys themselves)
   */
  app.get('/api-keys', async (request) => {
    const userId = getUserId(request);
    const providers = await apiKeyRepo.listProviders(userId);
    return { providers };
  });

  /**
   * POST /api-keys
   * Store or update an API key
   */
  app.post('/api-keys', async (request, reply) => {
    const userId = getUserId(request);
    const body = StoreApiKeySchema.parse(request.body);

    // Check if already exists
    const existing = await apiKeyRepo.listProviders(userId);

    if (existing.includes(body.provider)) {
      // Update
      await apiKeyRepo.update(userId, body.provider, body.apiKey);
      log.info(`API key updated for user ${userId}, provider ${body.provider}`);
      return { success: true, message: `${body.provider} API key updated` };
    } else {
      // Create
      await apiKeyRepo.create(userId, body.provider, body.apiKey);
      log.info(`API key stored for user ${userId}, provider ${body.provider}`);
      return reply.status(201).send({
        success: true,
        message: `${body.provider} API key stored`,
      });
    }
  });

  /**
   * DELETE /api-keys/:provider
   * Remove an API key
   */
  app.delete('/api-keys/:provider', async (request, reply) => {
    const userId = getUserId(request);
    const { provider } = request.params as { provider: string };

    const valid = ['deepseek', 'openai', 'anthropic', 'google', 'xai'];
    if (!valid.includes(provider)) {
      return reply.status(400).send({ error: `Invalid provider: ${provider}` });
    }

    await apiKeyRepo.delete(userId, provider);
    return { success: true, message: `${provider} API key deleted` };
  });
}
