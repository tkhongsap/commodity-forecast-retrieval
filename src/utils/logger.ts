/**
 * Enhanced Logging Utility Module
 * 
 * Structured logging system for data source tracking, performance monitoring,
 * and audit trail functionality. Provides comprehensive logging for Yahoo Finance
 * integration, fallback mechanisms, cache operations, and API performance metrics.
 * 
 * Features:
 * - Structured JSON logging with metadata
 * - Data source attribution tracking
 * - Performance metrics and timing
 * - Error classification and tracking
 * - Audit trail for data retrieval operations
 * - Configurable log levels and outputs
 * - Rolling statistics and metrics
 * - Integration with monitoring systems
 * 
 * @author Enhanced Logger Module
 * @version 1.0.0
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

/**
 * Data source types for attribution
 */
export enum DataSource {
  YAHOO_FINANCE = 'yahoo_finance',
  OPENAI_FALLBACK = 'openai_fallback',
  CACHE = 'cache',
  USER_INPUT = 'user_input',
  SYSTEM = 'system'
}

/**
 * Operation types for tracking
 */
export enum OperationType {
  PRICE_FETCH = 'price_fetch',
  QUOTE_FETCH = 'quote_fetch',
  CHART_FETCH = 'chart_fetch',
  VALIDATION = 'validation',
  CACHE_OPERATION = 'cache_operation',
  ERROR_HANDLING = 'error_handling',
  FALLBACK = 'fallback'
}

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp */
  timestamp: string;
  /** Component/module name */
  component: string;
  /** Operation type */
  operation?: OperationType;
  /** Data source */
  dataSource?: DataSource;
  /** Duration in milliseconds */
  duration?: number;
  /** Success/failure status */
  success?: boolean;
  /** Error information */
  error?: {
    type: string;
    message: string;
    stack?: string;
    code?: string;
  };
  /** Metadata */
  metadata?: {
    symbol?: string;
    price?: number;
    source?: string;
    cacheKey?: string;
    retryAttempt?: number;
    correlationId?: string;
    [key: string]: any;
  };
  /** Performance metrics */
  metrics?: {
    responseTime?: number;
    cacheHitRate?: number;
    errorRate?: number;
    throughput?: number;
    [key: string]: number;
  };
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Include timestamps */
  includeTimestamp: boolean;
  /** Enable JSON output */
  jsonFormat: boolean;
  /** Include stack traces for errors */
  includeStackTrace: boolean;
  /** Component name prefix */
  component: string;
  /** Enable console output */
  enableConsole: boolean;
  /** Enable file output */
  enableFile: boolean;
  /** File path for logs */
  filePath?: string;
  /** Enable metrics collection */
  enableMetrics: boolean;
  /** Max entries to keep in memory for metrics */
  maxMetricsEntries: number;
}

/**
 * Performance metrics aggregation
 */
export interface PerformanceMetrics {
  /** Total number of operations */
  totalOperations: number;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Success rate percentage */
  successRate: number;
  /** Average response time */
  averageResponseTime: number;
  /** Operations by data source */
  byDataSource: Record<DataSource, number>;
  /** Operations by type */
  byOperationType: Record<OperationType, number>;
  /** Recent error rate */
  recentErrorRate: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Time range for metrics */
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * Enhanced Logger Class
 */
export class EnhancedLogger {
  private config: LoggerConfig;
  private logEntries: LogEntry[] = [];
  private metricsBuffer: LogEntry[] = [];
  private startTime: number;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      includeTimestamp: true,
      jsonFormat: true,
      includeStackTrace: true,
      component: 'CommodityTracker',
      enableConsole: true,
      enableFile: false,
      enableMetrics: true,
      maxMetricsEntries: 1000,
      ...config
    };
    
    this.startTime = Date.now();
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: any, operation?: OperationType, dataSource?: DataSource): void {
    this.log(LogLevel.DEBUG, message, metadata, operation, dataSource);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: any, operation?: OperationType, dataSource?: DataSource): void {
    this.log(LogLevel.INFO, message, metadata, operation, dataSource);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: any, operation?: OperationType, dataSource?: DataSource): void {
    this.log(LogLevel.WARN, message, metadata, operation, dataSource);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: any, operation?: OperationType, dataSource?: DataSource): void {
    const errorInfo = error ? {
      type: error.constructor.name,
      message: error.message,
      stack: this.config.includeStackTrace ? error.stack : undefined,
      code: (error as any).code
    } : undefined;

    this.log(LogLevel.ERROR, message, metadata, operation, dataSource, undefined, errorInfo);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, metadata?: any, operation?: OperationType, dataSource?: DataSource): void {
    const errorInfo = error ? {
      type: error.constructor.name,
      message: error.message,
      stack: this.config.includeStackTrace ? error.stack : undefined,
      code: (error as any).code
    } : undefined;

    this.log(LogLevel.FATAL, message, metadata, operation, dataSource, undefined, errorInfo);
  }

  /**
   * Log data retrieval operation
   */
  logDataRetrieval(
    symbol: string,
    dataSource: DataSource,
    success: boolean,
    duration?: number,
    price?: number,
    error?: Error,
    metadata?: any
  ): void {
    const operation = OperationType.PRICE_FETCH;
    const message = `Data retrieval for ${symbol} from ${dataSource}: ${success ? 'SUCCESS' : 'FAILED'}`;
    
    const combinedMetadata = {
      symbol,
      price,
      source: dataSource,
      ...metadata
    };

    if (success) {
      this.log(LogLevel.INFO, message, combinedMetadata, operation, dataSource, duration);
    } else {
      const errorInfo = error ? {
        type: error.constructor.name,
        message: error.message,
        stack: this.config.includeStackTrace ? error.stack : undefined
      } : undefined;
      
      this.log(LogLevel.ERROR, message, combinedMetadata, operation, dataSource, duration, errorInfo);
    }
  }

  /**
   * Log cache operation
   */
  logCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear',
    key: string,
    success: boolean = true,
    metadata?: any
  ): void {
    const message = `Cache ${operation} for key: ${key}`;
    const level = success ? LogLevel.DEBUG : LogLevel.WARN;
    
    this.log(level, message, {
      cacheKey: key,
      cacheOperation: operation,
      ...metadata
    }, OperationType.CACHE_OPERATION, DataSource.CACHE);
  }

  /**
   * Log API performance metrics
   */
  logPerformanceMetrics(
    operation: OperationType,
    dataSource: DataSource,
    responseTime: number,
    success: boolean,
    metadata?: any
  ): void {
    const message = `Performance: ${operation} from ${dataSource} - ${responseTime}ms`;
    
    this.log(LogLevel.DEBUG, message, metadata, operation, dataSource, responseTime, undefined, {
      responseTime,
      success: success ? 1 : 0
    });
  }

  /**
   * Log fallback mechanism activation
   */
  logFallback(
    primarySource: DataSource,
    fallbackSource: DataSource,
    reason: string,
    metadata?: any
  ): void {
    const message = `Fallback activated: ${primarySource} -> ${fallbackSource}. Reason: ${reason}`;
    
    this.log(LogLevel.WARN, message, {
      primarySource,
      fallbackSource,
      fallbackReason: reason,
      ...metadata
    }, OperationType.FALLBACK);
  }

  /**
   * Log validation results
   */
  logValidation(
    symbol: string,
    isValid: boolean,
    confidence: number,
    errors: string[] = [],
    warnings: string[] = [],
    metadata?: any
  ): void {
    const message = `Validation for ${symbol}: ${isValid ? 'VALID' : 'INVALID'} (confidence: ${confidence.toFixed(2)})`;
    const level = isValid ? LogLevel.INFO : LogLevel.WARN;
    
    this.log(level, message, {
      symbol,
      validationResult: isValid,
      confidence,
      errors,
      warnings,
      ...metadata
    }, OperationType.VALIDATION);
  }

  /**
   * Log audit trail entry
   */
  logAuditTrail(
    action: string,
    user: string,
    resource: string,
    success: boolean,
    metadata?: any
  ): void {
    const message = `AUDIT: ${user} ${action} ${resource} - ${success ? 'SUCCESS' : 'FAILED'}`;
    
    this.log(LogLevel.INFO, message, {
      auditAction: action,
      auditUser: user,
      auditResource: resource,
      auditResult: success,
      ...metadata
    });
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(timeRangeMinutes: number = 60): PerformanceMetrics {
    const cutoffTime = Date.now() - (timeRangeMinutes * 60 * 1000);
    const recentEntries = this.metricsBuffer.filter(entry => 
      new Date(entry.timestamp).getTime() > cutoffTime
    );

    const totalOps = recentEntries.length;
    const successfulOps = recentEntries.filter(entry => entry.success === true).length;
    const failedOps = totalOps - successfulOps;
    
    const byDataSource: Record<DataSource, number> = {
      [DataSource.YAHOO_FINANCE]: 0,
      [DataSource.OPENAI_FALLBACK]: 0,
      [DataSource.CACHE]: 0,
      [DataSource.USER_INPUT]: 0,
      [DataSource.SYSTEM]: 0
    };

    const byOperationType: Record<OperationType, number> = {
      [OperationType.PRICE_FETCH]: 0,
      [OperationType.QUOTE_FETCH]: 0,
      [OperationType.CHART_FETCH]: 0,
      [OperationType.VALIDATION]: 0,
      [OperationType.CACHE_OPERATION]: 0,
      [OperationType.ERROR_HANDLING]: 0,
      [OperationType.FALLBACK]: 0
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    recentEntries.forEach(entry => {
      if (entry.dataSource) {
        byDataSource[entry.dataSource]++;
      }
      if (entry.operation) {
        byOperationType[entry.operation]++;
      }
      if (entry.duration) {
        totalResponseTime += entry.duration;
        responseTimeCount++;
      }
      if (entry.operation === OperationType.CACHE_OPERATION) {
        if (entry.metadata?.cacheOperation === 'hit') cacheHits++;
        if (entry.metadata?.cacheOperation === 'miss') cacheMisses++;
      }
    });

    const averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    const cacheHitRate = (cacheHits + cacheMisses) > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0;

    return {
      totalOperations: totalOps,
      successfulOperations: successfulOps,
      failedOperations: failedOps,
      successRate: totalOps > 0 ? (successfulOps / totalOps) * 100 : 0,
      averageResponseTime,
      byDataSource,
      byOperationType,
      recentErrorRate: totalOps > 0 ? (failedOps / totalOps) * 100 : 0,
      cacheHitRate,
      timeRange: {
        start: new Date(cutoffTime).toISOString(),
        end: new Date().toISOString()
      }
    };
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count: number = 100, level?: LogLevel): LogEntry[] {
    let filtered = this.logEntries;
    
    if (level !== undefined) {
      filtered = this.logEntries.filter(entry => entry.level >= level);
    }
    
    return filtered.slice(-count);
  }

  /**
   * Clear logs and metrics
   */
  clearLogs(): void {
    this.logEntries = [];
    this.metricsBuffer = [];
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      config: this.config,
      startTime: new Date(this.startTime).toISOString(),
      exportTime: new Date().toISOString(),
      totalEntries: this.logEntries.length,
      logs: this.logEntries
    }, null, 2);
  }

  // Private methods

  private log(
    level: LogLevel,
    message: string,
    metadata?: any,
    operation?: OperationType,
    dataSource?: DataSource,
    duration?: number,
    error?: any,
    metrics?: Record<string, number>
  ): void {
    if (level < this.config.level) {
      return; // Skip logs below configured level
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      component: this.config.component,
      operation,
      dataSource,
      duration,
      success: level < LogLevel.WARN ? true : (level === LogLevel.WARN ? undefined : false),
      error,
      metadata,
      metrics
    };

    // Store in memory
    this.logEntries.push(entry);
    
    // Store in metrics buffer if metrics are enabled
    if (this.config.enableMetrics) {
      this.metricsBuffer.push(entry);
      
      // Trim metrics buffer if it exceeds max size
      if (this.metricsBuffer.length > this.config.maxMetricsEntries) {
        this.metricsBuffer = this.metricsBuffer.slice(-this.config.maxMetricsEntries);
      }
    }

    // Output to console
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Output to file (if configured)
    if (this.config.enableFile && this.config.filePath) {
      this.outputToFile(entry);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    
    if (this.config.jsonFormat) {
      const consoleMethod = this.getConsoleMethod(entry.level);
      consoleMethod(JSON.stringify(entry));
    } else {
      const timestamp = this.config.includeTimestamp ? `[${entry.timestamp}] ` : '';
      const component = `[${entry.component}] `;
      const levelStr = `[${levelName}] `;
      const message = entry.message;
      
      const formattedMessage = `${timestamp}${component}${levelStr}${message}`;
      
      const consoleMethod = this.getConsoleMethod(entry.level);
      if (entry.metadata || entry.error) {
        consoleMethod(formattedMessage, {
          ...(entry.metadata && { metadata: entry.metadata }),
          ...(entry.error && { error: entry.error })
        });
      } else {
        consoleMethod(formattedMessage);
      }
    }
  }

  private outputToFile(entry: LogEntry): void {
    // File output would be implemented here
    // For now, this is a placeholder for future file logging implementation
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }
}

/**
 * Singleton logger instance
 */
let loggerInstance: EnhancedLogger | null = null;

/**
 * Get singleton logger instance
 */
export function getLogger(config?: Partial<LoggerConfig>): EnhancedLogger {
  if (!loggerInstance) {
    loggerInstance = new EnhancedLogger(config);
  }
  return loggerInstance;
}

/**
 * Create new logger instance
 */
export function createLogger(config?: Partial<LoggerConfig>): EnhancedLogger {
  return new EnhancedLogger(config);
}

/**
 * Convenience functions for common logging operations
 */
export const Logger = {
  debug: (message: string, metadata?: any, operation?: OperationType, dataSource?: DataSource) =>
    getLogger().debug(message, metadata, operation, dataSource),
  
  info: (message: string, metadata?: any, operation?: OperationType, dataSource?: DataSource) =>
    getLogger().info(message, metadata, operation, dataSource),
  
  warn: (message: string, metadata?: any, operation?: OperationType, dataSource?: DataSource) =>
    getLogger().warn(message, metadata, operation, dataSource),
  
  error: (message: string, error?: Error, metadata?: any, operation?: OperationType, dataSource?: DataSource) =>
    getLogger().error(message, error, metadata, operation, dataSource),
  
  fatal: (message: string, error?: Error, metadata?: any, operation?: OperationType, dataSource?: DataSource) =>
    getLogger().fatal(message, error, metadata, operation, dataSource),
  
  logDataRetrieval: (symbol: string, dataSource: DataSource, success: boolean, duration?: number, price?: number, error?: Error, metadata?: any) =>
    getLogger().logDataRetrieval(symbol, dataSource, success, duration, price, error, metadata),
  
  logCacheOperation: (operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear', key: string, success?: boolean, metadata?: any) =>
    getLogger().logCacheOperation(operation, key, success, metadata),
  
  logPerformanceMetrics: (operation: OperationType, dataSource: DataSource, responseTime: number, success: boolean, metadata?: any) =>
    getLogger().logPerformanceMetrics(operation, dataSource, responseTime, success, metadata),
  
  logFallback: (primarySource: DataSource, fallbackSource: DataSource, reason: string, metadata?: any) =>
    getLogger().logFallback(primarySource, fallbackSource, reason, metadata),
  
  logValidation: (symbol: string, isValid: boolean, confidence: number, errors?: string[], warnings?: string[], metadata?: any) =>
    getLogger().logValidation(symbol, isValid, confidence, errors, warnings, metadata),
  
  getMetrics: (timeRangeMinutes?: number) =>
    getLogger().getPerformanceMetrics(timeRangeMinutes)
};

// Export default
export default EnhancedLogger;