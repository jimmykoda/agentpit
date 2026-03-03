// ============================================
// AgentPit - WebSocket Route
// Real-time agent event streaming
// ============================================

import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { AgentManager } from '../../engine/agent-manager';
import { AgentEvent } from '../../types';
import { createLogger } from '../../utils/logger';

const log = createLogger('WebSocket');

interface WsClient {
  socket: WebSocket;
  userId: string;
  subscribedAgents: Set<string>;
}

export function websocketRoutes(manager: AgentManager) {
  // Track connected clients
  const clients = new Map<string, WsClient>();
  let clientIdCounter = 0;

  // Forward agent events to subscribed clients
  manager.on('agent-event', (event: AgentEvent) => {
    const agentId = event.agentId;
    const payload = JSON.stringify({
      type: 'agent_event',
      event,
    });

    for (const [id, client] of clients) {
      if (client.subscribedAgents.has(agentId) || client.subscribedAgents.has('*')) {
        try {
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(payload);
          }
        } catch (err) {
          log.error(`Failed to send to client ${id}`, err);
        }
      }
    }
  });

  return async function (app: FastifyInstance): Promise<void> {

    /**
     * WebSocket: /ws
     * Connect, authenticate, then subscribe to agent events
     *
     * Client sends:
     *   { type: "auth", token: "jwt..." }
     *   { type: "subscribe", agentIds: ["uuid1", "uuid2"] }
     *   { type: "unsubscribe", agentIds: ["uuid1"] }
     *   { type: "ping" }
     *
     * Server sends:
     *   { type: "auth_ok", userId: "..." }
     *   { type: "auth_error", message: "..." }
     *   { type: "agent_event", event: { ... } }
     *   { type: "pong" }
     */
    app.get('/ws', { websocket: true }, (socket, request) => {
      const clientId = `ws-${++clientIdCounter}`;
      let authenticated = false;
      let userId = '';

      const client: WsClient = {
        socket: socket as any,
        userId: '',
        subscribedAgents: new Set(),
      };

      log.info(`Client connected: ${clientId}`);

      // Auth timeout — must authenticate within 10s
      const authTimeout = setTimeout(() => {
        if (!authenticated) {
          (socket as any).send(JSON.stringify({
            type: 'auth_error',
            message: 'Authentication timeout',
          }));
          (socket as any).close();
        }
      }, 10_000);

      (socket as any).on('message', async (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());

          switch (msg.type) {
            case 'auth': {
              try {
                const payload = app.jwt.verify<{ userId: string; wallet: string }>(msg.token);
                authenticated = true;
                userId = payload.userId;
                client.userId = userId;
                clients.set(clientId, client);
                clearTimeout(authTimeout);

                (socket as any).send(JSON.stringify({
                  type: 'auth_ok',
                  userId,
                }));
                log.info(`Client ${clientId} authenticated as ${userId}`);
              } catch (err) {
                (socket as any).send(JSON.stringify({
                  type: 'auth_error',
                  message: 'Invalid token',
                }));
              }
              break;
            }

            case 'subscribe': {
              if (!authenticated) return;
              const ids = msg.agentIds as string[];
              if (Array.isArray(ids)) {
                ids.forEach(id => client.subscribedAgents.add(id));
                (socket as any).send(JSON.stringify({
                  type: 'subscribed',
                  agentIds: Array.from(client.subscribedAgents),
                }));
                log.debug(`Client ${clientId} subscribed to ${ids.length} agents`);
              }
              break;
            }

            case 'unsubscribe': {
              if (!authenticated) return;
              const unsub = msg.agentIds as string[];
              if (Array.isArray(unsub)) {
                unsub.forEach(id => client.subscribedAgents.delete(id));
              }
              break;
            }

            case 'ping': {
              (socket as any).send(JSON.stringify({ type: 'pong', ts: Date.now() }));
              break;
            }

            default:
              log.debug(`Unknown message type from ${clientId}: ${msg.type}`);
          }
        } catch (err) {
          log.error(`Bad message from ${clientId}`, err);
        }
      });

      (socket as any).on('close', () => {
        clearTimeout(authTimeout);
        clients.delete(clientId);
        log.info(`Client ${clientId} disconnected`);
      });

      (socket as any).on('error', (err: Error) => {
        log.error(`WebSocket error for ${clientId}`, err);
        clients.delete(clientId);
      });
    });
  };
}
