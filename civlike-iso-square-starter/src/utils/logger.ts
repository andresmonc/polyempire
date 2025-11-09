/**
 * Centralized logging utility.
 * Can be extended to support log levels, filtering, and production mode.
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

class Logger {
  private level: LogLevel = LOG_LEVELS.DEBUG;
  private enabled: boolean = true;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  debug(...args: unknown[]): void {
    if (this.enabled && this.level <= LOG_LEVELS.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.enabled && this.level <= LOG_LEVELS.INFO) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.enabled && this.level <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.enabled && this.level <= LOG_LEVELS.ERROR) {
      console.error('[ERROR]', ...args);
    }
  }
}

export const logger = new Logger();

