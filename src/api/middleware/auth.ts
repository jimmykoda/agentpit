// ============================================
// AgentPit - Auth Middleware
// Wallet signature verification + JWT
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { ethers } from 'ethers';
import { createLogger } from '../../utils/logger';

const log = createLogger('Auth');

// In-memory nonce store (swap for Redis in production)
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

// Nonce expiry: 5 minutes
const NONCE_TTL_MS = 5 * 60 * 1000;

/**
 * Generate a nonce for wallet auth
 */
export function generateNonce(walletAddress: string): string {
  const nonce = `AgentPit authentication: ${Date.now()}-${Math.random().toString(36).substring(2)}`;
  const normalized = walletAddress.toLowerCase();

  nonceStore.set(normalized, {
    nonce,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });

  // Clean up expired nonces periodically
  if (nonceStore.size > 10000) {
    cleanExpiredNonces();
  }

  return nonce;
}

/**
 * Verify a wallet signature and return the wallet address
 */
export function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  nonce: string,
): boolean {
  const normalized = walletAddress.toLowerCase();

  // Check nonce exists and matches
  const stored = nonceStore.get(normalized);
  if (!stored) {
    log.warn(`No nonce found for wallet ${normalized}`);
    return false;
  }

  if (stored.nonce !== nonce) {
    log.warn(`Nonce mismatch for wallet ${normalized}`);
    return false;
  }

  if (Date.now() > stored.expiresAt) {
    nonceStore.delete(normalized);
    log.warn(`Nonce expired for wallet ${normalized}`);
    return false;
  }

  // Verify the signature
  try {
    const recoveredAddress = ethers.verifyMessage(nonce, signature);
    const isValid = recoveredAddress.toLowerCase() === normalized;

    if (isValid) {
      // Consume the nonce (one-time use)
      nonceStore.delete(normalized);
      log.info(`Wallet ${normalized} authenticated`);
    } else {
      log.warn(`Signature verification failed for ${normalized}`);
    }

    return isValid;
  } catch (err) {
    log.error('Signature verification error', err);
    return false;
  }
}

/**
 * JWT auth guard - extracts user from token
 */
export async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Extract user ID from authenticated request
 */
export function getUserId(request: FastifyRequest): string {
  const payload = request.user as { userId: string; wallet: string };
  return payload.userId;
}

/**
 * Extract wallet address from authenticated request
 */
export function getWallet(request: FastifyRequest): string {
  const payload = request.user as { userId: string; wallet: string };
  return payload.wallet;
}

// --- Helpers ---

function cleanExpiredNonces(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of nonceStore) {
    if (now > value.expiresAt) {
      nonceStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    log.debug(`Cleaned ${cleaned} expired nonces`);
  }
}
