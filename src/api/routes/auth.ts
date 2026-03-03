// ============================================
// AgentPit - Auth Routes
// POST /auth/nonce       - Get a nonce for wallet signing
// POST /auth/verify      - Verify signature, get JWT
// POST /auth/refresh     - Refresh JWT token
// ============================================

import { FastifyInstance } from 'fastify';
import { NonceRequestSchema, VerifySignatureSchema } from '../schemas';
import { generateNonce, verifyWalletSignature, authGuard } from '../middleware/auth';
import { UserRepository } from '../../db/repositories/users';
import { createLogger } from '../../utils/logger';

const log = createLogger('AuthRoutes');

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const userRepo = new UserRepository();

  /**
   * GET /auth/nonce
   * Request a nonce for wallet signing
   */
  app.post('/auth/nonce', async (request, reply) => {
    const body = NonceRequestSchema.parse(request.body);
    const nonce = generateNonce(body.walletAddress);

    return { nonce };
  });

  /**
   * POST /auth/verify
   * Verify wallet signature, create/find user, return JWT
   */
  app.post('/auth/verify', async (request, reply) => {
    const body = VerifySignatureSchema.parse(request.body);

    // Verify the signature
    const isValid = verifyWalletSignature(
      body.walletAddress,
      body.signature,
      body.nonce,
    );

    if (!isValid) {
      return reply.status(401).send({
        error: 'Authentication failed',
        message: 'Invalid signature or expired nonce',
      });
    }

    // Find or create user
    const normalized = body.walletAddress.toLowerCase();
    let user = await userRepo.getByWallet(normalized);

    if (!user) {
      user = await userRepo.create({ wallet_address: normalized });
      log.info(`New user created: ${user.id} (${normalized})`);
    }

    // Generate JWT
    const token = app.jwt.sign(
      {
        userId: user.id,
        wallet: normalized,
      },
      { expiresIn: '24h' },
    );

    const refreshToken = app.jwt.sign(
      {
        userId: user.id,
        wallet: normalized,
        type: 'refresh',
      },
      { expiresIn: '7d' },
    );

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        wallet: normalized,
        tier: (user as any).subscription_tier || 'free',
        createdAt: user.created_at,
      },
    };
  });

  /**
   * POST /auth/refresh
   * Refresh an expired access token
   */
  app.post('/auth/refresh', async (request, reply) => {
    try {
      const { refreshToken } = request.body as { refreshToken: string };
      if (!refreshToken) {
        return reply.status(400).send({ error: 'refreshToken required' });
      }

      // Verify refresh token
      const payload = app.jwt.verify<{ userId: string; wallet: string; type: string }>(refreshToken);
      if (payload.type !== 'refresh') {
        return reply.status(401).send({ error: 'Invalid refresh token' });
      }

      // Issue new access token
      const token = app.jwt.sign(
        {
          userId: payload.userId,
          wallet: payload.wallet,
        },
        { expiresIn: '24h' },
      );

      return { token };
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }
  });

  /**
   * GET /auth/me
   * Get current user info (requires auth)
   */
  app.get('/auth/me', { preHandler: [authGuard] }, async (request, reply) => {
    const payload = request.user as { userId: string; wallet: string };
    const user = await userRepo.getById(payload.userId);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return {
      id: user.id,
      wallet: user.wallet_address,
      email: user.email,
      tier: (user as any).subscription_tier || 'free',
      createdAt: user.created_at,
    };
  });
}
