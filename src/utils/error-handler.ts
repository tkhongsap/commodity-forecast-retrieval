/**
 * Centralized Error Handling System for Yahoo Finance Integration
 * 
 * Comprehensive error handling system that provides error classification, recovery strategies,
 * monitoring capabilities, and structured error management across all Yahoo Finance integration
 * components. This system handles network failures, API errors, rate limiting, data validation,
 * and provides intelligent recovery mechanisms.
 * 
 * Features:
 * - Error classification (retryable vs non-retryable)
 * - Recovery strategies (retry, fallback, circuit breaker)
 * - Error monitoring and metrics
 * - Context-aware error logging
 * - Circuit breaker pattern implementation
 * - Rate limiting backoff strategies
 * - Error correlation and tracking
 * 
 * @author Yahoo Finance Error Handling System
 * @version 1.0.0
 */

import { AxiosError } from 'axios';

/**
 * Error severity levels for classification and alerting
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories for comprehensive classification
 */
export enum ErrorCategory {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  API_ERROR = 'api_error',
  DATA_VALIDATION = 'data_validation',
  PARSING = 'parsing',
  CONFIGURATION = 'configuration',
  CIRCUIT_BREAKER = 'circuit_breaker',
  UNKNOWN = 'unknown'
}

/**
 * Recovery strategy types
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  FALLBACK = 'fallback',
  CIRCUIT_BREAKER = 'circuit_breaker',
  CACHE_FALLBACK = 'cache_fallback',
  SKIP = 'skip',
  ALERT = 'alert',
  NONE = 'none'
}

/**
 * Error context information for debugging and monitoring
 */
export interface ErrorContext {
  /** Unique correlation ID for tracking */
  correlationId: string;
  /** Timestamp when error occurred */
  timestamp: string;
  /** Component or service where error occurred */
  component: string;
  /** Operation being performed when error occurred */
  operation: string;
  /** Yahoo Finance symbol being processed */
  symbol?: string;
  /** Request URL if applicable */
  url?: string;
  /** HTTP method if applicable */
  method?: string;
  /** Request timeout used */
  timeout?: number;
  /** Retry attempt number */
  retryAttempt?: number;
  /** Additional context data */
  metadata?: Record<string, any>;
}

/**
 * Comprehensive error information structure
 */
export interface ErrorInfo {
  /** Error message */
  message: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Recommended recovery strategy */
  recoveryStrategy: RecoveryStrategy;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Original error object */
  originalError?: Error;
  /** Error context */
  context: ErrorContext;
  /** Suggested actions for resolution */
  suggestedActions: string[];
  /** Error count for this type */
  count?: number;
}

/**
 * Error metrics for monitoring
 */
export interface ErrorMetrics {
  /** Total error count */
  totalErrors: number;
  /** Errors by category */
  errorsByCategory: Record<ErrorCategory, number>;
  /** Errors by severity */
  errorsBySeverity: Record<ErrorSeverity, number>;
  /** Retry success rate */
  retrySuccessRate: number;
  /** Average recovery time */
  averageRecoveryTime: number;
  /** Circuit breaker state changes */
  circuitBreakerTriggers: number;
  /** Error rate trends */
  errorRateOverTime: Array<{ timestamp: string; errorRate: number }>;
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time to wait before trying again (ms) */
  recoveryTimeout: number;
  /** Time to monitor for failures (ms) */
  monitorTimeout: number;
  /** Minimum number of requests to trigger circuit breaker */
  minimumRequestThreshold: number;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private requestCount: number = 0;
  private successCount: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>, context: ErrorContext): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.requestCount = 0;
        this.successCount = 0;
      } else {
        throw new YahooFinanceError({
          message: 'Circuit breaker is open',
          category: ErrorCategory.CIRCUIT_BREAKER,
          severity: ErrorSeverity.HIGH,
          retryable: false,
          recoveryStrategy: RecoveryStrategy.FALLBACK,
          context,
          suggestedActions: [
            'Wait for circuit breaker to reset',
            'Use cached data if available',
            'Try alternative data source'
          ]
        });
      }
    }

    try {
      this.requestCount++;
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // If we're in half-open state and success, close the circuit
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.requestCount >= this.config.minimumRequestThreshold &&
        this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      successCount: this.successCount,
      failureRate: this.requestCount > 0 ? this.failureCount / this.requestCount : 0
    };
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.requestCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Comprehensive error handling class
 */
export class YahooFinanceError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly recoveryStrategy: RecoveryStrategy;
  public readonly statusCode?: number;
  public readonly originalError?: Error;
  public readonly context: ErrorContext;
  public readonly suggestedActions: string[];
  public readonly timestamp: string;

  constructor(errorInfo: ErrorInfo) {
    super(errorInfo.message);
    this.name = 'YahooFinanceError';
    this.category = errorInfo.category;
    this.severity = errorInfo.severity;
    this.retryable = errorInfo.retryable;
    this.recoveryStrategy = errorInfo.recoveryStrategy;
    this.statusCode = errorInfo.statusCode;
    this.originalError = errorInfo.originalError;
    this.context = errorInfo.context;
    this.suggestedActions = errorInfo.suggestedActions;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Create a detailed error report
   */
  toDetailedReport(): string {
    return `
Error Report - ${this.timestamp}
================================
Message: ${this.message}
Category: ${this.category}
Severity: ${this.severity}
Retryable: ${this.retryable}
Recovery Strategy: ${this.recoveryStrategy}
Status Code: ${this.statusCode || 'N/A'}
Component: ${this.context.component}
Operation: ${this.context.operation}
Symbol: ${this.context.symbol || 'N/A'}
Correlation ID: ${this.context.correlationId}
Retry Attempt: ${this.context.retryAttempt || 0}

Suggested Actions:
${this.suggestedActions.map(action => `- ${action}`).join('\n')}

Original Error: ${this.originalError?.message || 'N/A'}
Stack Trace: ${this.originalError?.stack || this.stack}
    `.trim();
  }
}

/**
 * Error classifier for automatic error categorization
 */
export class ErrorClassifier {
  /**
   * Classify error based on type, status code, and message
   */
  static classifyError(error: Error | AxiosError, context: ErrorContext): ErrorInfo {
    if (error instanceof YahooFinanceError) {
      return {
        message: error.message,
        category: error.category,
        severity: error.severity,
        retryable: error.retryable,
        recoveryStrategy: error.recoveryStrategy,
        statusCode: error.statusCode,
        originalError: error.originalError,
        context: error.context,
        suggestedActions: error.suggestedActions
      };
    }

    // Classify Axios errors
    if (this.isAxiosError(error)) {
      return this.classifyAxiosError(error, context);
    }

    // Classify network errors
    if (this.isNetworkError(error)) {
      return this.classifyNetworkError(error, context);
    }

    // Classify timeout errors
    if (this.isTimeoutError(error)) {
      return this.classifyTimeoutError(error, context);
    }

    // Classify parsing errors
    if (this.isParsingError(error)) {
      return this.classifyParsingError(error, context);
    }

    // Default classification for unknown errors
    return this.classifyUnknownError(error, context);
  }

  private static isAxiosError(error: any): error is AxiosError {
    return error.isAxiosError === true;
  }

  private static isNetworkError(error: Error): boolean {
    const networkErrorCodes = ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH'];
    return networkErrorCodes.some(code => error.message.includes(code));
  }

  private static isTimeoutError(error: Error): boolean {
    return error.message.toLowerCase().includes('timeout') || 
           error.message.includes('ETIMEDOUT') ||
           error.message.includes('ECONNABORTED');
  }

  private static isParsingError(error: Error): boolean {
    return error.message.toLowerCase().includes('json') ||
           error.message.toLowerCase().includes('parse') ||
           error.message.toLowerCase().includes('syntax');
  }

  private static classifyAxiosError(error: AxiosError, context: ErrorContext): ErrorInfo {
    const status = error.response?.status;
    
    // Rate limiting
    if (status === 429) {
      return {
        message: 'Rate limit exceeded',
        category: ErrorCategory.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        recoveryStrategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        statusCode: status,
        originalError: error,
        context,
        suggestedActions: [
          'Wait before retrying',
          'Implement exponential backoff',
          'Check rate limiting configuration',
          'Consider caching to reduce requests'
        ]
      };
    }

    // Authentication errors
    if (status === 401 || status === 403) {
      return {
        message: 'Authentication failed',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.ALERT,
        statusCode: status,
        originalError: error,
        context,
        suggestedActions: [
          'Check API credentials',
          'Verify access permissions',
          'Contact Yahoo Finance support'
        ]
      };
    }

    // Server errors
    if (status && status >= 500) {
      return {
        message: `Server error: ${error.response?.statusText || 'Unknown server error'}`,
        category: ErrorCategory.API_ERROR,
        severity: ErrorSeverity.HIGH,
        retryable: true,
        recoveryStrategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        statusCode: status,
        originalError: error,
        context,
        suggestedActions: [
          'Retry with exponential backoff',
          'Check Yahoo Finance service status',
          'Use cached data if available',
          'Implement circuit breaker'
        ]
      };
    }

    // Client errors
    if (status && status >= 400 && status < 500) {
      return {
        message: `Client error: ${error.response?.statusText || 'Bad request'}`,
        category: ErrorCategory.API_ERROR,
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.ALERT,
        statusCode: status,
        originalError: error,
        context,
        suggestedActions: [
          'Check request parameters',
          'Verify symbol format',
          'Review API documentation',
          'Validate input data'
        ]
      };
    }

    // Network errors without response
    if (!error.response) {
      return {
        message: `Network error: ${error.message}`,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        retryable: true,
        recoveryStrategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        originalError: error,
        context,
        suggestedActions: [
          'Check internet connection',
          'Verify DNS resolution',
          'Check firewall settings',
          'Retry with exponential backoff'
        ]
      };
    }

    // Default API error
    return {
      message: `API error: ${error.message}`,
      category: ErrorCategory.API_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      recoveryStrategy: RecoveryStrategy.RETRY,
      statusCode: status,
      originalError: error,
      context,
      suggestedActions: [
        'Retry the request',
        'Check error details',
        'Review request parameters'
      ]
    };
  }

  private static classifyNetworkError(error: Error, context: ErrorContext): ErrorInfo {
    return {
      message: `Network connectivity error: ${error.message}`,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      recoveryStrategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
      originalError: error,
      context,
      suggestedActions: [
        'Check internet connection',
        'Verify DNS settings',
        'Check proxy configuration',
        'Retry with exponential backoff',
        'Use cached data if available'
      ]
    };
  }

  private static classifyTimeoutError(error: Error, context: ErrorContext): ErrorInfo {
    return {
      message: `Request timeout: ${error.message}`,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      recoveryStrategy: RecoveryStrategy.RETRY,
      originalError: error,
      context,
      suggestedActions: [
        'Increase request timeout',
        'Retry with exponential backoff',
        'Check network latency',
        'Use cached data if available'
      ]
    };
  }

  private static classifyParsingError(error: Error, context: ErrorContext): ErrorInfo {
    return {
      message: `Data parsing error: ${error.message}`,
      category: ErrorCategory.PARSING,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.ALERT,
      originalError: error,
      context,
      suggestedActions: [
        'Check data format',
        'Verify API response structure',
        'Update parsing logic',
        'Report data format issue'
      ]
    };
  }

  private static classifyUnknownError(error: Error, context: ErrorContext): ErrorInfo {
    return {
      message: `Unknown error: ${error.message}`,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.ALERT,
      originalError: error,
      context,
      suggestedActions: [
        'Review error details',
        'Check application logs',
        'Report unknown error type',
        'Implement specific handling'
      ]
    };
  }
}

/**
 * Error monitoring and metrics collection
 */
export class ErrorMonitor {
  private static instance: ErrorMonitor;
  private errors: ErrorInfo[] = [];
  private metrics: ErrorMetrics;
  private listeners: Array<(error: ErrorInfo) => void> = [];

  private constructor() {
    this.metrics = this.initializeMetrics();
    this.setupCleanupScheduler();
  }

  static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor();
    }
    return ErrorMonitor.instance;
  }

  /**
   * Record an error for monitoring
   */
  recordError(error: ErrorInfo): void {
    this.errors.push(error);
    this.updateMetrics(error);
    this.notifyListeners(error);
    
    // Keep only last 1000 errors in memory
    if (this.errors.length > 1000) {
      this.errors = this.errors.slice(-1000);
    }
  }

  /**
   * Add error listener for real-time monitoring
   */
  addErrorListener(listener: (error: ErrorInfo) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove error listener
   */
  removeErrorListener(listener: (error: ErrorInfo) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Get current error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): ErrorInfo[] {
    return this.errors.filter(error => error.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorInfo[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(minutes: number = 60): ErrorInfo[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.errors.filter(error => 
      new Date(error.context.timestamp).getTime() > cutoff
    );
  }

  /**
   * Clear all recorded errors
   */
  clearErrors(): void {
    this.errors = [];
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      errorsByCategory: Object.values(ErrorCategory).reduce((acc, category) => {
        acc[category] = 0;
        return acc;
      }, {} as Record<ErrorCategory, number>),
      errorsBySeverity: Object.values(ErrorSeverity).reduce((acc, severity) => {
        acc[severity] = 0;
        return acc;
      }, {} as Record<ErrorSeverity, number>),
      retrySuccessRate: 0,
      averageRecoveryTime: 0,
      circuitBreakerTriggers: 0,
      errorRateOverTime: []
    };
  }

  private updateMetrics(error: ErrorInfo): void {
    this.metrics.totalErrors++;
    this.metrics.errorsByCategory[error.category]++;
    this.metrics.errorsBySeverity[error.severity]++;

    // Update error rate over time (every 5 minutes)
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const recentErrorRate = this.errors.filter(e => 
      new Date(e.context.timestamp) > fiveMinutesAgo
    ).length / 5; // errors per minute

    this.metrics.errorRateOverTime.push({
      timestamp: now.toISOString(),
      errorRate: recentErrorRate
    });

    // Keep only last 24 hours of error rate data
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    this.metrics.errorRateOverTime = this.metrics.errorRateOverTime.filter(point =>
      new Date(point.timestamp) > oneDayAgo
    );
  }

  private notifyListeners(error: ErrorInfo): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  private setupCleanupScheduler(): void {
    // Clean up old errors every hour
    setInterval(() => {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      this.errors = this.errors.filter(error =>
        new Date(error.context.timestamp).getTime() > oneWeekAgo
      );
    }, 60 * 60 * 1000); // 1 hour
  }
}

/**
 * Utility functions for error handling
 */

/**
 * Generate unique correlation ID for error tracking
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create error context with default values
 */
export function createErrorContext(
  component: string,
  operation: string,
  overrides: Partial<ErrorContext> = {}
): ErrorContext {
  return {
    correlationId: generateCorrelationId(),
    timestamp: new Date().toISOString(),
    component,
    operation,
    ...overrides
  };
}

/**
 * Handle error with automatic classification and monitoring
 */
export function handleError(
  error: Error | AxiosError,
  context: ErrorContext
): YahooFinanceError {
  const errorInfo = ErrorClassifier.classifyError(error, context);
  const yahooError = new YahooFinanceError(errorInfo);
  
  // Record error for monitoring
  ErrorMonitor.getInstance().recordError(errorInfo);
  
  return yahooError;
}

/**
 * Check if error should be retried based on its classification
 */
export function shouldRetryError(error: YahooFinanceError): boolean {
  return error.retryable && 
         error.recoveryStrategy === RecoveryStrategy.RETRY ||
         error.recoveryStrategy === RecoveryStrategy.EXPONENTIAL_BACKOFF;
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  jitter: boolean = true
): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  
  if (jitter) {
    // Add random jitter to prevent thundering herd
    const jitterAmount = exponentialDelay * 0.1; // 10% jitter
    return exponentialDelay + (Math.random() * jitterAmount * 2 - jitterAmount);
  }
  
  return exponentialDelay;
}

/**
 * Default export
 */
export default {
  YahooFinanceError,
  ErrorClassifier,
  ErrorMonitor,
  CircuitBreaker,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  generateCorrelationId,
  createErrorContext,
  handleError,
  shouldRetryError,
  calculateRetryDelay
};