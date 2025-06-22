/**
 * Structured Error Logging System for Yahoo Finance Integration
 * 
 * Comprehensive error logging system that provides structured logging with context,
 * correlation IDs, and detailed debugging information for Yahoo Finance integration.
 * This system enables effective debugging, monitoring, and troubleshooting.
 * 
 * Features:
 * - Structured JSON logging
 * - Correlation ID tracking across requests
 * - Context-aware logging with metadata
 * - Multiple log levels and destinations
 * - Performance impact monitoring
 * - Log aggregation and filtering
 * - Integration with external logging services
 * - Sensitive data masking
 * 
 * @author Yahoo Finance Error Logging System
 * @version 1.0.0
 */

import { 
  YahooFinanceError,
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
  generateCorrelationId
} from './error-handler';

/**
 * Log levels for different types of messages
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

/**
 * Log destinations for different output targets
 */
export enum LogDestination {
  CONSOLE = 'console',
  FILE = 'file',
  HTTP = 'http',
  EXTERNAL_SERVICE = 'external_service',
  BUFFER = 'buffer'
}

/**
 * Structured log entry format
 */
export interface LogEntry {
  /** Unique log entry ID */
  id: string;
  /** Log timestamp in ISO format */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Component that generated the log */
  component: string;
  /** Operation that generated the log */
  operation: string;
  /** Correlation ID for tracking related logs */
  correlationId: string;
  /** Request/session ID if applicable */
  requestId?: string;
  /** User/client ID if applicable */
  userId?: string;
  /** Error details if this is an error log */
  error?: {
    /** Error type/class */
    type: string;
    /** Error message */
    message: string;
    /** Error stack trace */
    stack?: string;
    /** Error category */
    category?: ErrorCategory;
    /** Error severity */
    severity?: ErrorSeverity;
    /** HTTP status code if applicable */
    statusCode?: number;
    /** Whether error is retryable */
    retryable?: boolean;
  };
  /** Context metadata */
  context: {
    /** Yahoo Finance symbol being processed */
    symbol?: string;
    /** HTTP method if applicable */
    method?: string;
    /** URL being accessed */
    url?: string;
    /** Request timeout value */
    timeout?: number;
    /** Retry attempt number */
    retryAttempt?: number;
    /** Performance metrics */
    performance?: {
      /** Duration in milliseconds */
      duration?: number;
      /** Memory usage */
      memoryUsage?: number;
      /** CPU usage */
      cpuUsage?: number;
    };
    /** Additional metadata */
    metadata?: Record<string, any>;
  };
  /** Environment information */
  environment: {
    /** Node.js version */
    nodeVersion: string;
    /** Application version */
    appVersion?: string;
    /** Environment name (dev/staging/prod) */
    env: string;
    /** Hostname */
    hostname: string;
    /** Process ID */
    pid: number;
  };
  /** Tags for log filtering and aggregation */
  tags: string[];
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Log destinations */
  destinations: LogDestination[];
  /** Whether to include stack traces */
  includeStackTrace: boolean;
  /** Whether to mask sensitive data */
  maskSensitiveData: boolean;
  /** Maximum log entry size in characters */
  maxEntrySize: number;
  /** Log buffer size for batching */
  bufferSize: number;
  /** Log flush interval in milliseconds */
  flushInterval: number;
  /** File logging configuration */
  file?: {
    /** Log file path */
    path: string;
    /** Maximum file size in bytes */
    maxSize: number;
    /** Number of backup files to keep */
    maxFiles: number;
    /** Whether to rotate logs */
    rotate: boolean;
  };
  /** HTTP logging configuration */
  http?: {
    /** HTTP endpoint URL */
    url: string;
    /** Request headers */
    headers: Record<string, string>;
    /** Request timeout */
    timeout: number;
    /** Batch size for HTTP logging */
    batchSize: number;
  };
  /** External service configuration */
  external?: {
    /** Service type (e.g., 'datadog', 'splunk', 'elk') */
    service: string;
    /** Service configuration */
    config: Record<string, any>;
  };
}

/**
 * Log filter for selective logging
 */
export interface LogFilter {
  /** Component name pattern */
  component?: string | RegExp;
  /** Operation name pattern */
  operation?: string | RegExp;
  /** Log level range */
  level?: {
    min: LogLevel;
    max: LogLevel;
  };
  /** Tags to include */
  includeTags?: string[];
  /** Tags to exclude */
  excludeTags?: string[];
  /** Symbol pattern */
  symbol?: string | RegExp;
  /** Custom filter function */
  custom?: (entry: LogEntry) => boolean;
}

/**
 * Log aggregation result
 */
export interface LogAggregation {
  /** Total log count */
  totalCount: number;
  /** Counts by log level */
  byLevel: Record<LogLevel, number>;
  /** Counts by component */
  byComponent: Record<string, number>;
  /** Counts by error category */
  byErrorCategory: Record<ErrorCategory, number>;
  /** Most common errors */
  topErrors: Array<{
    message: string;
    count: number;
    category?: ErrorCategory;
  }>;
  /** Time range */
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * Structured Logger Implementation
 */
export class StructuredLogger {
  private static instance: StructuredLogger;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private correlationTracker: Map<string, string> = new Map();
  private logStats: {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByComponent: Record<string, number>;
    errorCount: number;
    lastFlush: number;
  };

  private constructor(config: LoggerConfig) {
    this.config = config;
    this.logStats = {
      totalLogs: 0,
      logsByLevel: Object.values(LogLevel).filter(v => typeof v === 'number').reduce((acc, level) => {
        acc[level as LogLevel] = 0;
        return acc;
      }, {} as Record<LogLevel, number>),
      logsByComponent: {},
      errorCount: 0,
      lastFlush: Date.now()
    };

    this.setupAutoFlush();
  }

  /**
   * Get singleton logger instance
   */
  static getInstance(config?: LoggerConfig): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger(
        config || DEFAULT_LOGGER_CONFIG
      );
    }
    return StructuredLogger.instance;
  }

  /**
   * Log trace message
   */
  trace(
    message: string,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, any> = {}
  ): void {
    this.log(LogLevel.TRACE, message, context, metadata);
  }

  /**
   * Log debug message
   */
  debug(
    message: string,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, any> = {}
  ): void {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }

  /**
   * Log info message
   */
  info(
    message: string,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, any> = {}
  ): void {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  /**
   * Log warning message
   */
  warn(
    message: string,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, any> = {}
  ): void {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  /**
   * Log error message
   */
  error(
    message: string,
    error?: Error | YahooFinanceError,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, any> = {}
  ): void {
    const logEntry = this.createLogEntry(LogLevel.ERROR, message, context, metadata);
    
    if (error) {
      logEntry.error = this.serializeError(error);
    }
    
    this.writeLog(logEntry);
  }

  /**
   * Log fatal error message
   */
  fatal(
    message: string,
    error?: Error | YahooFinanceError,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, any> = {}
  ): void {
    const logEntry = this.createLogEntry(LogLevel.FATAL, message, context, metadata);
    
    if (error) {
      logEntry.error = this.serializeError(error);
    }
    
    this.writeLog(logEntry);
    
    // Immediately flush fatal errors
    this.flush();
  }

  /**
   * Log Yahoo Finance specific error
   */
  logYahooFinanceError(
    error: YahooFinanceError,
    additionalContext: Record<string, any> = {}
  ): void {
    const message = `Yahoo Finance Error: ${error.message}`;
    const context = {
      ...error.context,
      ...additionalContext
    };
    
    this.error(message, error, context);
  }

  /**
   * Start operation tracking with correlation ID
   */
  startOperation(
    component: string,
    operation: string,
    context: Partial<ErrorContext> = {}
  ): string {
    const correlationId = context.correlationId || generateCorrelationId();
    
    this.correlationTracker.set(correlationId, `${component}:${operation}`);
    
    this.debug(`Operation started: ${operation}`, {
      component,
      operation,
      correlationId,
      ...context
    });
    
    return correlationId;
  }

  /**
   * End operation tracking
   */
  endOperation(
    correlationId: string,
    success: boolean = true,
    duration?: number,
    result?: any
  ): void {
    const operationInfo = this.correlationTracker.get(correlationId);
    
    if (!operationInfo) {
      this.warn(`Attempted to end unknown operation with correlation ID: ${correlationId}`);
      return;
    }
    
    const [component, operation] = operationInfo.split(':');
    const message = `Operation ${success ? 'completed' : 'failed'}: ${operation}`;
    
    const context = {
      component,
      operation,
      correlationId
    };
    
    const metadata = {
      success,
      duration,
      result: result ? this.sanitizeResult(result) : undefined
    };
    
    if (success) {
      this.info(message, context, metadata);
    } else {
      this.warn(message, context, metadata);
    }
    
    this.correlationTracker.delete(correlationId);
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    context: Partial<ErrorContext> = {},
    metrics: Record<string, number> = {}
  ): void {
    const message = `Performance: ${operation} completed in ${duration}ms`;
    
    const performanceContext = {
      ...context,
      performance: {
        duration,
        ...metrics
      }
    };
    
    if (duration > 10000) { // More than 10 seconds
      this.warn(message, performanceContext);
    } else if (duration > 5000) { // More than 5 seconds
      this.info(message, performanceContext);
    } else {
      this.debug(message, performanceContext);
    }
  }

  /**
   * Query logs with filters
   */
  queryLogs(
    filter: LogFilter,
    limit: number = 100,
    offset: number = 0
  ): LogEntry[] {
    return this.logBuffer
      .filter(entry => this.matchesFilter(entry, filter))
      .slice(offset, offset + limit);
  }

  /**
   * Aggregate log data
   */
  aggregateLogs(
    filter: LogFilter = {},
    timeRange?: { start: Date; end: Date }
  ): LogAggregation {
    let filteredLogs = this.logBuffer.filter(entry => this.matchesFilter(entry, filter));
    
    if (timeRange) {
      filteredLogs = filteredLogs.filter(entry => {
        const entryTime = new Date(entry.timestamp);
        return entryTime >= timeRange.start && entryTime <= timeRange.end;
      });
    }
    
    const aggregation: LogAggregation = {
      totalCount: filteredLogs.length,
      byLevel: Object.values(LogLevel).filter(v => typeof v === 'number').reduce((acc, level) => {
        acc[level as LogLevel] = 0;
        return acc;
      }, {} as Record<LogLevel, number>),
      byComponent: {},
      byErrorCategory: Object.values(ErrorCategory).reduce((acc, category) => {
        acc[category] = 0;
        return acc;
      }, {} as Record<ErrorCategory, number>),
      topErrors: [],
      timeRange: {
        start: timeRange?.start.toISOString() || filteredLogs[0]?.timestamp || new Date().toISOString(),
        end: timeRange?.end.toISOString() || filteredLogs[filteredLogs.length - 1]?.timestamp || new Date().toISOString()
      }
    };
    
    // Count by level
    filteredLogs.forEach(entry => {
      aggregation.byLevel[entry.level]++;
      
      // Count by component
      if (!aggregation.byComponent[entry.component]) {
        aggregation.byComponent[entry.component] = 0;
      }
      aggregation.byComponent[entry.component]++;
      
      // Count by error category
      if (entry.error?.category) {
        aggregation.byErrorCategory[entry.error.category]++;
      }
    });
    
    // Calculate top errors
    const errorCounts: Record<string, { count: number; category?: ErrorCategory }> = {};
    filteredLogs
      .filter(entry => entry.error)
      .forEach(entry => {
        const errorKey = entry.error!.message;
        if (!errorCounts[errorKey]) {
          errorCounts[errorKey] = { count: 0, category: entry.error!.category };
        }
        errorCounts[errorKey].count++;
      });
    
    aggregation.topErrors = Object.entries(errorCounts)
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return aggregation;
  }

  /**
   * Get logger statistics
   */
  getStats() {
    return {
      ...this.logStats,
      bufferSize: this.logBuffer.length,
      correlationTrackerSize: this.correlationTracker.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime() * 1000
    };
  }

  /**
   * Flush log buffer to destinations
   */
  flush(): void {
    if (this.logBuffer.length === 0) return;
    
    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];
    
    this.config.destinations.forEach(destination => {
      this.writeToDestination(destination, logsToFlush);
    });
    
    this.logStats.lastFlush = Date.now();
  }

  /**
   * Clear all logs and reset state
   */
  clear(): void {
    this.logBuffer = [];
    this.correlationTracker.clear();
    this.logStats = {
      totalLogs: 0,
      logsByLevel: Object.values(LogLevel).filter(v => typeof v === 'number').reduce((acc, level) => {
        acc[level as LogLevel] = 0;
        return acc;
      }, {} as Record<LogLevel, number>),
      logsByComponent: {},
      errorCount: 0,
      lastFlush: Date.now()
    };
  }

  // Private methods

  private log(
    level: LogLevel,
    message: string,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, any> = {}
  ): void {
    if (level < this.config.level) return;
    
    const logEntry = this.createLogEntry(level, message, context, metadata);
    this.writeLog(logEntry);
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, any> = {}
  ): LogEntry {
    const now = new Date();
    const correlationId = context.correlationId || generateCorrelationId();
    
    const entry: LogEntry = {
      id: generateCorrelationId(),
      timestamp: now.toISOString(),
      level,
      message: this.config.maskSensitiveData ? this.maskSensitiveData(message) : message,
      component: context.component || 'unknown',
      operation: context.operation || 'unknown',
      correlationId,
      requestId: context.metadata?.requestId,
      userId: context.metadata?.userId,
      context: {
        symbol: context.symbol,
        method: context.method,
        url: context.url ? this.maskSensitiveData(context.url) : undefined,
        timeout: context.timeout,
        retryAttempt: context.retryAttempt,
        metadata: this.config.maskSensitiveData ? this.maskSensitiveData(metadata) : metadata
      },
      environment: {
        nodeVersion: process.version,
        appVersion: process.env.APP_VERSION || '1.0.0',
        env: process.env.NODE_ENV || 'development',
        hostname: process.env.HOSTNAME || 'localhost',
        pid: process.pid
      },
      tags: this.generateTags(level, context, metadata)
    };
    
    // Truncate entry if too large
    if (JSON.stringify(entry).length > this.config.maxEntrySize) {
      entry.message = entry.message.substring(0, Math.floor(this.config.maxEntrySize / 4));
      entry.context.metadata = { truncated: true };
    }
    
    return entry;
  }

  private writeLog(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Update statistics
    this.logStats.totalLogs++;
    this.logStats.logsByLevel[entry.level]++;
    
    if (!this.logStats.logsByComponent[entry.component]) {
      this.logStats.logsByComponent[entry.component] = 0;
    }
    this.logStats.logsByComponent[entry.component]++;
    
    if (entry.level >= LogLevel.ERROR) {
      this.logStats.errorCount++;
    }
    
    // Auto-flush if buffer is full or this is a high-priority log
    if (this.logBuffer.length >= this.config.bufferSize || entry.level >= LogLevel.ERROR) {
      this.flush();
    }
  }

  private serializeError(error: Error | YahooFinanceError): LogEntry['error'] {
    const errorData: LogEntry['error'] = {
      type: error.constructor.name,
      message: error.message
    };
    
    if (this.config.includeStackTrace && error.stack) {
      errorData.stack = error.stack;
    }
    
    if (error instanceof YahooFinanceError) {
      errorData.category = error.category;
      errorData.severity = error.severity;
      errorData.statusCode = error.statusCode;
      errorData.retryable = error.retryable;
    }
    
    return errorData;
  }

  private generateTags(
    level: LogLevel,
    context: Partial<ErrorContext>,
    metadata: Record<string, any>
  ): string[] {
    const tags: string[] = [];
    
    // Add level tag
    tags.push(`level:${LogLevel[level].toLowerCase()}`);
    
    // Add component tag
    if (context.component) {
      tags.push(`component:${context.component}`);
    }
    
    // Add operation tag
    if (context.operation) {
      tags.push(`operation:${context.operation}`);
    }
    
    // Add symbol tag
    if (context.symbol) {
      tags.push(`symbol:${context.symbol}`);
    }
    
    // Add retry tag
    if (context.retryAttempt && context.retryAttempt > 0) {
      tags.push('retry');
    }
    
    // Add environment tag
    tags.push(`env:${process.env.NODE_ENV || 'development'}`);
    
    return tags;
  }

  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    // Component filter
    if (filter.component) {
      if (typeof filter.component === 'string') {
        if (entry.component !== filter.component) return false;
      } else {
        if (!filter.component.test(entry.component)) return false;
      }
    }
    
    // Operation filter
    if (filter.operation) {
      if (typeof filter.operation === 'string') {
        if (entry.operation !== filter.operation) return false;
      } else {
        if (!filter.operation.test(entry.operation)) return false;
      }
    }
    
    // Level filter
    if (filter.level) {
      if (entry.level < filter.level.min || entry.level > filter.level.max) {
        return false;
      }
    }
    
    // Tags filter
    if (filter.includeTags) {
      if (!filter.includeTags.some(tag => entry.tags.includes(tag))) {
        return false;
      }
    }
    
    if (filter.excludeTags) {
      if (filter.excludeTags.some(tag => entry.tags.includes(tag))) {
        return false;
      }
    }
    
    // Symbol filter
    if (filter.symbol && entry.context.symbol) {
      if (typeof filter.symbol === 'string') {
        if (entry.context.symbol !== filter.symbol) return false;
      } else {
        if (!filter.symbol.test(entry.context.symbol)) return false;
      }
    }
    
    // Custom filter
    if (filter.custom) {
      if (!filter.custom(entry)) return false;
    }
    
    return true;
  }

  private writeToDestination(destination: LogDestination, logs: LogEntry[]): void {
    try {
      switch (destination) {
        case LogDestination.CONSOLE:
          this.writeToConsole(logs);
          break;
        case LogDestination.FILE:
          this.writeToFile(logs);
          break;
        case LogDestination.HTTP:
          this.writeToHttp(logs);
          break;
        case LogDestination.EXTERNAL_SERVICE:
          this.writeToExternalService(logs);
          break;
        default:
          console.warn(`Unknown log destination: ${destination}`);
      }
    } catch (error) {
      console.error(`Failed to write to destination ${destination}:`, error);
    }
  }

  private writeToConsole(logs: LogEntry[]): void {
    logs.forEach(entry => {
      const levelName = LogLevel[entry.level];
      const timestamp = new Date(entry.timestamp).toISOString();
      const message = `[${timestamp}] ${levelName} [${entry.component}:${entry.operation}] ${entry.message}`;
      
      switch (entry.level) {
        case LogLevel.TRACE:
        case LogLevel.DEBUG:
          console.debug(message, entry);
          break;
        case LogLevel.INFO:
          console.info(message, entry);
          break;
        case LogLevel.WARN:
          console.warn(message, entry);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(message, entry);
          break;
        default:
          console.log(message, entry);
      }
    });
  }

  private writeToFile(logs: LogEntry[]): void {
    // File writing would be implemented here
    // For now, just log to console that file writing would occur
    console.log(`Would write ${logs.length} log entries to file`);
  }

  private writeToHttp(logs: LogEntry[]): void {
    // HTTP logging would be implemented here
    console.log(`Would send ${logs.length} log entries via HTTP`);
  }

  private writeToExternalService(logs: LogEntry[]): void {
    // External service integration would be implemented here
    console.log(`Would send ${logs.length} log entries to external service`);
  }

  private maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      // Mask common sensitive patterns
      return data
        .replace(/api[_-]?key[=:]\s*[\w-]+/gi, 'api_key=***')
        .replace(/token[=:]\s*[\w.-]+/gi, 'token=***')
        .replace(/password[=:]\s*\w+/gi, 'password=***')
        .replace(/secret[=:]\s*\w+/gi, 'secret=***');
    }
    
    if (typeof data === 'object' && data !== null) {
      const masked = { ...data };
      const sensitiveKeys = ['apiKey', 'token', 'password', 'secret', 'authorization'];
      
      sensitiveKeys.forEach(key => {
        if (key in masked) {
          masked[key] = '***';
        }
      });
      
      return masked;
    }
    
    return data;
  }

  private sanitizeResult(result: any): any {
    // Limit result size for logging
    const resultStr = JSON.stringify(result);
    if (resultStr.length > 1000) {
      return { truncated: true, preview: resultStr.substring(0, 100) + '...' };
    }
    return result;
  }

  private setupAutoFlush(): void {
    setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }
}

/**
 * Default logger configuration
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  destinations: [LogDestination.CONSOLE],
  includeStackTrace: true,
  maskSensitiveData: true,
  maxEntrySize: 10000, // 10KB
  bufferSize: 100,
  flushInterval: 5000, // 5 seconds
  file: {
    path: './logs/yahoo-finance.log',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    rotate: true
  }
};

/**
 * Convenience functions for common logging patterns
 */

/**
 * Get logger instance with default config
 */
export function getLogger(): StructuredLogger {
  return StructuredLogger.getInstance();
}

/**
 * Log operation start
 */
export function logOperationStart(
  component: string,
  operation: string,
  context: Partial<ErrorContext> = {}
): string {
  return getLogger().startOperation(component, operation, context);
}

/**
 * Log operation end
 */
export function logOperationEnd(
  correlationId: string,
  success: boolean = true,
  duration?: number
): void {
  getLogger().endOperation(correlationId, success, duration);
}

/**
 * Log Yahoo Finance error
 */
export function logYahooFinanceError(
  error: YahooFinanceError,
  context: Record<string, any> = {}
): void {
  getLogger().logYahooFinanceError(error, context);
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  duration: number,
  context: Partial<ErrorContext> = {}
): void {
  getLogger().logPerformance(operation, duration, context);
}

/**
 * Export logging utilities
 */
export default {
  StructuredLogger,
  LogLevel,
  LogDestination,
  DEFAULT_LOGGER_CONFIG,
  getLogger,
  logOperationStart,
  logOperationEnd,
  logYahooFinanceError,
  logPerformance
};