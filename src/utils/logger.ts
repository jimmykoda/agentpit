// ============================================
// AgentPit - Logger
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, component: string, message: string, data?: any): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}] [${component}]`;
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (data !== undefined) {
    logFn(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    logFn(`${prefix} ${message}`);
  }
}

export function createLogger(component: string) {
  return {
    debug: (msg: string, data?: any) => log('debug', component, msg, data),
    info: (msg: string, data?: any) => log('info', component, msg, data),
    warn: (msg: string, data?: any) => log('warn', component, msg, data),
    error: (msg: string, data?: any) => log('error', component, msg, data),
  };
}
