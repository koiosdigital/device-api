import { Injectable, LogLevel, Scope } from '@nestjs/common';

export type LogContext = {
  requestId?: string;
  userId?: string;
  deviceId?: string;
  [key: string]: unknown;
};

type LogLevelType = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

const LOG_LEVEL_COLORS: Record<LogLevelType, string> = {
  log: '\x1b[32m', // green
  error: '\x1b[31m', // red
  warn: '\x1b[33m', // yellow
  debug: '\x1b[35m', // magenta
  verbose: '\x1b[36m', // cyan
};

const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';

// Server type prefix for log output
export type ServerType = 'Nest' | 'SocketServer';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService {
  private context = 'Application';
  private contextData: LogContext = {};
  private serverType: ServerType = 'Nest';
  private static enabledLevels: Set<LogLevelType> = new Set(LoggerService.getLogLevels() as LogLevelType[]);

  setContext(context: string): void {
    this.context = context;
  }

  setServerType(type: ServerType): void {
    this.serverType = type;
  }

  setContextData(data: LogContext): void {
    this.contextData = { ...this.contextData, ...data };
  }

  clearContextData(): void {
    this.contextData = {};
  }

  private formatMessage(message: string): string {
    const contextParts: string[] = [];

    if (this.contextData.requestId) {
      contextParts.push(`req=${this.contextData.requestId}`);
    }
    if (this.contextData.userId) {
      contextParts.push(`user=${this.contextData.userId}`);
    }
    if (this.contextData.deviceId) {
      contextParts.push(`device=${this.contextData.deviceId}`);
    }

    for (const [key, value] of Object.entries(this.contextData)) {
      if (!['requestId', 'userId', 'deviceId'].includes(key) && value !== undefined) {
        contextParts.push(`${key}=${String(value)}`);
      }
    }

    if (contextParts.length > 0) {
      return `[${contextParts.join(' ')}] ${message}`;
    }

    return message;
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  private printMessage(level: LogLevelType, message: string, ...optionalParams: unknown[]): void {
    if (!LoggerService.enabledLevels.has(level)) {
      return;
    }

    const pid = process.pid;
    const timestamp = this.formatTimestamp();
    const color = LOG_LEVEL_COLORS[level];
    const levelLabel = level.toUpperCase().padEnd(7);
    const contextLabel = `${YELLOW}[${this.context}]${RESET}`;
    const formattedMessage = this.formatMessage(message);

    // Format: [Nest] 53380  - 12/28/2025, 10:27:10 PM     LOG [Context] Message
    const output = `[${this.serverType}] ${pid}  - ${timestamp} ${color}${levelLabel}${RESET} ${contextLabel} ${formattedMessage}`;

    if (level === 'error') {
      console.error(output, ...optionalParams);
    } else if (level === 'warn') {
      console.warn(output, ...optionalParams);
    } else {
      console.log(output, ...optionalParams);
    }
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('log', message, ...optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('error', message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('warn', message, ...optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('debug', message, ...optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('verbose', message, ...optionalParams);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): LoggerService {
    const childLogger = new LoggerService();
    childLogger.setContext(this.context);
    childLogger.setServerType(this.serverType);
    childLogger.setContextData({ ...this.contextData, ...context });
    return childLogger;
  }

  /**
   * Get log levels based on environment
   */
  static getLogLevels(): LogLevel[] {
    const env = process.env.NODE_ENV ?? 'development';

    if (env === 'production') {
      return ['log', 'warn', 'error'];
    }

    return ['log', 'warn', 'error', 'debug', 'verbose'];
  }
}
