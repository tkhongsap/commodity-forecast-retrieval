/**
 * Simplified Error Handling Utilities
 * 
 * Consolidated error handling for the commodity forecasting system.
 * Provides essential error classification, retry logic, and logging.
 */

import { AxiosError } from 'axios';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  API_ERROR = 'api_error',
  DATA_VALIDATION = 'data_validation',
  PARSING = 'parsing',
  UNKNOWN = 'unknown'
}

export enum RecoveryStrategy {
  RETRY = 'retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  FALLBACK = 'fallback',
  CACHE_FALLBACK = 'cache_fallback',
  ALERT = 'alert',
  NONE = 'none'
}

export interface ErrorContext {
  correlationId: string;
  timestamp: string;
  component: string;
  operation: string;
  symbol?: string;
  url?: string;
  method?: string;
  timeout?: number;
  retryAttempt?: number;
  metadata?: Record<string, any>;
}

export interface ErrorInfo {
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  strategy: RecoveryStrategy;
  recoveryStrategy?: RecoveryStrategy;
  statusCode?: number;
  context: ErrorContext;
  originalError?: Error;
  suggestedActions?: string[];
}

export class YahooFinanceError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly strategy: RecoveryStrategy;
  public readonly recoveryStrategy: RecoveryStrategy;
  public readonly statusCode?: number;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly suggestedActions?: string[];

  constructor(info: ErrorInfo) {
    super(info.message);
    this.name = 'YahooFinanceError';
    this.category = info.category;
    this.severity = info.severity;
    this.retryable = info.retryable;
    this.strategy = info.strategy;
    this.recoveryStrategy = info.recoveryStrategy || info.strategy;
    this.statusCode = info.statusCode;
    this.context = info.context;
    this.originalError = info.originalError;
    this.suggestedActions = info.suggestedActions;
  }

  toDetailedReport(): string {
    const report = {
      message: this.message,
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      recoveryStrategy: this.recoveryStrategy,
      statusCode: this.statusCode,
      context: {
        correlationId: this.context.correlationId,
        timestamp: this.context.timestamp,
        component: this.context.component,
        operation: this.context.operation,
        symbol: this.context.symbol,
        url: this.context.url,
        retryAttempt: this.context.retryAttempt
      },
      suggestedActions: this.suggestedActions,
      originalError: this.originalError?.message
    };
    return JSON.stringify(report, null, 2);
  }
}

export function createErrorContext(
  component: string,
  operation: string,
  options: Partial<ErrorContext> = {}
): ErrorContext {
  return {
    correlationId: generateCorrelationId(),
    timestamp: new Date().toISOString(),
    component,
    operation,
    ...options
  };
}

export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function classifyError(error: Error, context: ErrorContext): ErrorInfo {
  if (error instanceof AxiosError) {
    return classifyAxiosError(error, context);
  }

  return {
    message: error.message,
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    retryable: false,
    strategy: RecoveryStrategy.NONE,
    recoveryStrategy: RecoveryStrategy.NONE,
    context,
    originalError: error
  };
}

function classifyAxiosError(error: AxiosError, context: ErrorContext): ErrorInfo {
  const status = error.response?.status;
  
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      message: `Request timeout: ${error.message}`,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      strategy: RecoveryStrategy.RETRY,
      recoveryStrategy: RecoveryStrategy.RETRY,
      context,
      originalError: error
    };
  }

  if (!error.response) {
    return {
      message: `Network error: ${error.message}`,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
      recoveryStrategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
      context,
      originalError: error
    };
  }

  if (status === 429) {
    return {
      message: 'Rate limit exceeded',
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
      recoveryStrategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
      statusCode: 429,
      context,
      originalError: error
    };
  }

  if (status && status >= 500) {
    return {
      message: `Server error: ${status}`,
      category: ErrorCategory.API_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      strategy: RecoveryStrategy.RETRY,
      recoveryStrategy: RecoveryStrategy.RETRY,
      statusCode: status,
      context,
      originalError: error
    };
  }

  return {
    message: `API error: ${status} - ${error.message}`,
    category: ErrorCategory.API_ERROR,
    severity: ErrorSeverity.MEDIUM,
    retryable: false,
    strategy: RecoveryStrategy.NONE,
    recoveryStrategy: RecoveryStrategy.NONE,
    statusCode: status,
    context,
    originalError: error
  };
}

export function shouldRetryError(error: ErrorInfo | YahooFinanceError, maxRetries: number = 3): boolean {
  if (!error.retryable) return false;
  if (!error.context.retryAttempt) return true;
  return error.context.retryAttempt < maxRetries;
}

export function calculateRetryDelay(
  attempt: number, 
  baseDelay: number = 1000, 
  maxDelay: number = 10000,
  enableJitter: boolean = true
): number {
  const delay = baseDelay * Math.pow(2, attempt);
  const jitter = enableJitter ? Math.random() * 0.1 * delay : 0;
  return Math.min(delay + jitter, maxDelay);
}

export function handleError(error: Error, context: ErrorContext): YahooFinanceError {
  const errorInfo = classifyError(error, context);
  
  // Simple logging - in a real system you might use a proper logger
  console.error(`[${errorInfo.severity.toUpperCase()}] ${errorInfo.category}: ${errorInfo.message}`, {
    correlationId: context.correlationId,
    component: context.component,
    operation: context.operation,
    retryable: errorInfo.retryable,
    strategy: errorInfo.strategy
  });

  return new YahooFinanceError(errorInfo);
}

// Circuit Breaker Configuration Interface
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitorTimeout?: number;
  minimumRequestThreshold?: number;
}

// Circuit Breaker Implementation
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig | number = 5, recoveryTimeout?: number) {
    if (typeof config === 'number') {
      // Legacy constructor signature support
      this.config = {
        failureThreshold: config,
        recoveryTimeout: recoveryTimeout || 60000
      };
    } else {
      this.config = config;
    }
  }

  async execute<T>(operation: () => Promise<T>, context?: any): Promise<T> {
    this.totalRequests++;
    
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successfulRequests++;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state.toLowerCase();
  }

  getMetrics(): any {
    const failureRate = this.totalRequests > 0 ? (this.failures / this.totalRequests) * 100 : 0;
    return {
      state: this.state.toLowerCase(),
      failures: this.failures,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failureRate,
      lastFailureTime: this.lastFailureTime,
      config: this.config
    };
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
    this.totalRequests = 0;
    this.successfulRequests = 0;
  }
}

// Error Monitor for tracking error rates
export class ErrorMonitor {
  private static instance: ErrorMonitor;
  private errorCounts: Map<string, number> = new Map();
  private lastReset: number = Date.now();
  private resetInterval: number = 60000; // 1 minute

  static getInstance(): ErrorMonitor {
    if (!this.instance) {
      this.instance = new ErrorMonitor();
    }
    return this.instance;
  }

  recordError(categoryOrError: ErrorCategory | ErrorInfo, severity?: ErrorSeverity): void {
    this.checkReset();
    
    let category: ErrorCategory;
    let sev: ErrorSeverity;
    
    if (typeof categoryOrError === 'object') {
      // New API: single object parameter
      category = categoryOrError.category;
      sev = categoryOrError.severity;
    } else {
      // Legacy API: two separate parameters
      category = categoryOrError;
      sev = severity!;
    }
    
    const key = `${category}-${sev}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  getErrorRate(category: ErrorCategory, severity: ErrorSeverity): number {
    this.checkReset();
    const key = `${category}-${severity}`;
    return this.errorCounts.get(key) || 0;
  }

  getMetrics(): any {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    return {
      totalErrors,
      errorsByCategory: Object.fromEntries(this.errorCounts),
      retrySuccessRate: 85, // Mock value for compatibility
      averageRecoveryTime: 1500, // Mock value for compatibility
      circuitBreakerTriggers: 0, // Mock value for compatibility
      uptime: Date.now() - this.lastReset
    };
  }

  clearErrors(): void {
    this.errorCounts.clear();
  }

  getRecentErrors(minutes: number = 30): any[] {
    // For now, return all errors as we don't track timestamps per error
    // In a production system, you'd want to track timestamps
    return Array.from(this.errorCounts.entries()).map(([key, count]) => ({ 
      key, 
      count,
      timestamp: new Date().toISOString()
    }));
  }

  private checkReset(): void {
    if (Date.now() - this.lastReset > this.resetInterval) {
      this.errorCounts.clear();
      this.lastReset = Date.now();
    }
  }
}