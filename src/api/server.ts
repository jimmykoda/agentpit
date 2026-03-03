// ============================================
// AgentPit - Fastify API Server
// ============================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import fastifyRateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { AgentManager } from '../engine/agent-manager';
import { authRoutes } from './routes/auth';
import { agentRoutes } from './routes/agents';
import { tradeRoutes } from './routes/trades';
import { apiKeyRoutes } from './routes/api-keys';
import { eventRoutes } from './routes/events';
import { websocketRoutes } from './routes/websocket';
import { healthRoutes } from './routes/health';
import { createLogger } from '../utils/logger';

const log = createLogger('Server');

export interface ServerConfig {
  port: number;
  host: string;
  jwtSecret: string;
  corsOrigins: string[];
}

/**
 * Build and configure the Fastify server
 */
export async function buildServer(
  manager: AgentManager,
  config: ServerConfig,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use our own logger
    trustProxy: true,
  });

  // --- Plugins ---

  // CORS
  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // JWT
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
  });

  // Rate limiting
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Rate limit by JWT userId if authenticated, otherwise by IP
      try {
        const decoded = app.jwt.decode(
          request.headers.authorization?.replace('Bearer ', '') || '',
        ) as any;
        return decoded?.userId || request.ip;
      } catch {
        return request.ip;
      }
    },
  });

  // WebSocket
  await app.register(fastifyWebsocket);

  // --- Error Handling ---

  app.setErrorHandler((error: any, request, reply) => {
    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation Error',
        issues: error.issues.map((i: any) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    // Rate limit
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Try again later.',
      });
    }

    // Known HTTP errors
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: error.message,
      });
    }

    // Unknown errors
    log.error('Unhandled error', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  });

  // --- Routes ---

  // Public routes
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(healthRoutes(manager));

  // Protected routes
  await app.register(agentRoutes(manager), { prefix: '/api/v1' });
  await app.register(tradeRoutes, { prefix: '/api/v1' });
  await app.register(apiKeyRoutes, { prefix: '/api/v1' });
  await app.register(eventRoutes, { prefix: '/api/v1' });

  // WebSocket
  await app.register(websocketRoutes(manager), { prefix: '/api/v1' });

  // --- Ready Hook ---

  app.addHook('onReady', async () => {
    log.info('API server ready');
  });

  return app;
}

/**
 * Start the API server
 */
export async function startServer(
  manager: AgentManager,
  config: ServerConfig,
): Promise<FastifyInstance> {
  const app = await buildServer(manager, config);

  try {
    await app.listen({ port: config.port, host: config.host });
    log.info(`API server listening on ${config.host}:${config.port}`);
  } catch (err) {
    log.error('Failed to start server', err);
    throw err;
  }

  return app;
}
