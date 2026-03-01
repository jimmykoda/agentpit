// ============================================
// AgentPit - Job Scheduler
// Uses BullMQ to queue agent decision cycles
// ============================================

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const log = createLogger('Scheduler');

export interface AgentJobData {
  agentId: string;
  agentName: string;
  cycleCount: number;
}

export interface AgentJobResult {
  agentId: string;
  success: boolean;
  error?: string;
  duration: number;
}

// Rate limits per LLM provider (calls per minute)
const RATE_LIMITS: Record<string, number> = {
  deepseek: 60,
  openai: 60,
  anthropic: 50,
  google: 60,
  xai: 60,
};

export class AgentScheduler {
  private queue: Queue<AgentJobData, AgentJobResult>;
  private worker: Worker<AgentJobData, AgentJobResult> | null = null;
  private queueEvents: QueueEvents;

  private jobHandler: ((agentId: string) => Promise<void>) | null = null;

  constructor() {
    // Parse Redis URL for BullMQ connection config
    const redisUrl = config.redis.url;
    const connectionConfig = this.parseRedisUrl(redisUrl);

    // Create queue
    this.queue = new Queue<AgentJobData, AgentJobResult>('agent-decisions', {
      connection: connectionConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Queue events (for monitoring)
    this.queueEvents = new QueueEvents('agent-decisions', {
      connection: connectionConfig,
    });

    this.setupEventListeners();
    log.info('Scheduler initialized');
  }

  /**
   * Parse Redis URL into connection config
   */
  private parseRedisUrl(url: string) {
    if (url.startsWith('redis://')) {
      const parsed = new URL(url);
      return {
        host: parsed.hostname || 'localhost',
        port: parsed.port ? parseInt(parsed.port) : 6379,
        password: parsed.password || undefined,
        maxRetriesPerRequest: null, // Required for BullMQ
      };
    }
    // Default localhost
    return {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }

  /**
   * Set the job handler callback (called by AgentManager)
   */
  setJobHandler(handler: (agentId: string) => Promise<void>): void {
    this.jobHandler = handler;
  }

  /**
   * Start the worker to process jobs
   */
  async start(): Promise<void> {
    if (this.worker) {
      log.warn('Worker already running');
      return;
    }

    if (!this.jobHandler) {
      throw new Error('Job handler not set. Call setJobHandler() first.');
    }

    const redisUrl = config.redis.url;
    const connectionConfig = this.parseRedisUrl(redisUrl);

    this.worker = new Worker<AgentJobData, AgentJobResult>(
      'agent-decisions',
      async (job: Job<AgentJobData>) => {
        const startTime = Date.now();
        const { agentId, agentName, cycleCount } = job.data;

        log.info(`Processing job for agent ${agentName} (cycle #${cycleCount})`);

        try {
          await this.jobHandler!(agentId);

          const duration = Date.now() - startTime;
          return {
            agentId,
            success: true,
            duration,
          };
        } catch (error: any) {
          const duration = Date.now() - startTime;
          log.error(`Job failed for agent ${agentId}`, error);

          return {
            agentId,
            success: false,
            error: error.message,
            duration,
          };
        }
      },
      {
        connection: connectionConfig,
        concurrency: config.scheduler.concurrency,
        limiter: {
          max: config.scheduler.maxJobsPerSecond,
          duration: 1000,
        },
      }
    );

    log.info('Worker started');
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      log.info('Worker stopped');
    }
  }

  /**
   * Schedule a decision cycle for an agent
   */
  async scheduleDecision(
    agentId: string,
    agentName: string,
    cycleCount: number,
    intervalMs: number,
    llmProvider: string,
  ): Promise<void> {
    // Add repeatable job
    await this.queue.add(
      `agent-${agentId}`,
      { agentId, agentName, cycleCount },
      {
        repeat: {
          every: intervalMs,
        },
        jobId: `agent-${agentId}-repeat`, // Unique ID for repeatability
        // Rate limit based on LLM provider
        // (handled by worker limiter globally)
      }
    );

    log.info(`Scheduled repeatable job for agent ${agentName} every ${intervalMs}ms`);
  }

  /**
   * Cancel scheduled jobs for an agent
   */
  async cancelSchedule(agentId: string): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const agentJob = repeatableJobs.find(j => j.id === `agent-${agentId}-repeat`);

    if (agentJob) {
      await this.queue.removeRepeatableByKey(agentJob.key);
      log.info(`Cancelled schedule for agent ${agentId}`);
    }
  }

  /**
   * Pause jobs for an agent
   */
  async pauseAgent(agentId: string): Promise<void> {
    await this.queue.pause();
    log.info(`Paused jobs for agent ${agentId}`);
  }

  /**
   * Resume jobs for an agent
   */
  async resumeAgent(agentId: string): Promise<void> {
    await this.queue.resume();
    log.info(`Resumed jobs for agent ${agentId}`);
  }

  /**
   * Get queue stats
   */
  async getStats() {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();
    const completed = await this.queue.getCompletedCount();
    const failed = await this.queue.getFailedCount();
    const delayed = await this.queue.getDelayedCount();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Get jobs for a specific agent
   */
  async getAgentJobs(agentId: string, limit: number = 20) {
    const jobs = await this.queue.getJobs(['completed', 'failed'], 0, limit);
    return jobs.filter(j => j.data.agentId === agentId);
  }

  /**
   * Clean up old jobs
   */
  async cleanup(): Promise<void> {
    await this.queue.clean(3600 * 1000, 1000, 'completed'); // Clean completed older than 1h
    await this.queue.clean(86400 * 1000, 1000, 'failed'); // Clean failed older than 24h
    log.info('Queue cleaned up');
  }

  /**
   * Shutdown scheduler
   */
  async shutdown(): Promise<void> {
    await this.stop();
    await this.queueEvents.close();
    await this.queue.close();
    log.info('Scheduler shut down');
  }

  // --- Private Methods ---

  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      log.debug(`Job ${jobId} completed`, returnvalue);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      log.error(`Job ${jobId} failed: ${failedReason}`);
    });

    this.queueEvents.on('error', (err) => {
      log.error('Queue error', err);
    });
  }
}
