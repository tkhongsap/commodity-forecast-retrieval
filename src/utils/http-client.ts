/**
 * Yahoo Finance HTTP Client Utility
 * 
 * Robust HTTP client implementation with axios for Yahoo Finance API calls.
 * Includes timeout handling, retry logic with exponential backoff, rate limiting,
 * error handling, and request/response interceptors for comprehensive logging.
 * 
 * @author Yahoo Finance HTTP Client Module
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { HTTP_CONFIG, RETRY_CONFIG, RATE_LIMIT_CONFIG, API_ENDPOINTS } from '../config/yahoo-finance';
import { YahooFinanceResponse, ApiResponse, RateLimit } from '../types/yahoo-finance';
import { 
  YahooFinanceError, 
  ErrorMonitor, 
  CircuitBreaker,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  createErrorContext,
  handleError,
  shouldRetryError,
  calculateRetryDelay,
  generateCorrelationId
} from './error-utils';

/**
 * HTTP Client Error Types
 */
export enum HttpErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * HTTP Client Error Class
 */
export class HttpClientError extends Error {
  public readonly type: HttpErrorType;
  public readonly statusCode: number | undefined;
  public readonly retryCount: number;
  public readonly originalError: Error | undefined;

  constructor(
    type: HttpErrorType,
    message: string,
    statusCode?: number,
    retryCount: number = 0,
    originalError?: Error
  ) {
    super(message);
    this.name = 'HttpClientError';
    this.type = type;
    this.statusCode = statusCode;
    this.retryCount = retryCount;
    this.originalError = originalError;
  }
}

/**
 * Enhanced Rate Limiter with Comprehensive Error Handling
 */
class RateLimiter {
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private requestTimes: number[] = [];
  private rateLimitViolations: number = 0;
  private errorMonitor: ErrorMonitor;

  constructor(private config = RATE_LIMIT_CONFIG) {
    this.errorMonitor = ErrorMonitor.getInstance();
  }

  /**
   * Check if request can be made within rate limits
   */
  canMakeRequest(): boolean {
    if (!this.config.ENABLED) return true;

    const now = Date.now();
    const windowDuration = 60 * 1000; // 1 minute

    // Clean old requests from the sliding window
    this.requestTimes = this.requestTimes.filter(time => now - time < windowDuration);

    // Check burst limit
    if (this.requestTimes.length >= this.config.BURST_LIMIT) {
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < 1000) { // Less than 1 second
        this.recordRateLimitViolation('burst_limit_exceeded');
        return false;
      }
    }

    // Check requests per minute
    if (this.requestTimes.length >= this.config.REQUESTS_PER_MINUTE) {
      this.recordRateLimitViolation('requests_per_minute_exceeded');
      return false;
    }

    return true;
  }

  /**
   * Record a request being made
   */
  recordRequest(): void {
    const now = Date.now();
    this.requestTimes.push(now);
    this.lastRequestTime = now;
    this.requestCount++;
  }

  /**
   * Get current rate limit status with enhanced information
   */
  getRateLimit(): RateLimit & { violations: number; estimatedWaitTime: number } {
    const now = Date.now();
    
    // Clean old requests
    this.requestTimes = this.requestTimes.filter(time => now - time < 60 * 1000);
    
    const remaining = Math.max(0, this.config.REQUESTS_PER_MINUTE - this.requestTimes.length);
    const isLimited = !this.canMakeRequest();
    
    // Calculate estimated wait time if limited
    let estimatedWaitTime = 0;
    if (isLimited && this.requestTimes.length > 0) {
      const oldestRequest = Math.min(...this.requestTimes);
      estimatedWaitTime = Math.max(1000, 60 * 1000 - (now - oldestRequest));
    }
    
    return {
      requestsPerHour: this.config.REQUESTS_PER_HOUR,
      remaining,
      resetTime: now + (60 * 1000 - (now % (60 * 1000))),
      isLimited,
      violations: this.rateLimitViolations,
      estimatedWaitTime
    };
  }

  /**
   * Wait until next request is allowed with enhanced error handling
   */
  async waitForNextSlot(context?: { component?: string; operation?: string; symbol?: string }): Promise<void> {
    if (this.canMakeRequest()) return;

    const now = Date.now();
    const oldestRequest = Math.min(...this.requestTimes);
    const waitTime = Math.max(1000, 60 * 1000 - (now - oldestRequest));
    
    // Log rate limiting event
    if (context) {
      const errorContext = createErrorContext(
        context.component || 'RateLimiter',
        context.operation || 'waitForNextSlot',
        {
          ...(context.symbol !== undefined && { symbol: context.symbol }),
          metadata: {
            waitTime,
            requestsInWindow: this.requestTimes.length,
            rateLimitViolations: this.rateLimitViolations
          }
        }
      );

      console.log(`[RateLimiter] Rate limit reached, waiting ${waitTime}ms`, {
        correlationId: errorContext.correlationId,
        waitTime,
        requestsInWindow: this.requestTimes.length,
        symbol: context.symbol
      });
    }
    
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Handle rate limit exceeded error
   */
  async handleRateLimitExceeded(
    context: { component: string; operation: string; symbol?: string },
    retryAfter?: number
  ): Promise<void> {
    this.recordRateLimitViolation('api_rate_limit_exceeded');
    
    const errorContext = createErrorContext(context.component, context.operation, {
      ...(context.symbol !== undefined && { symbol: context.symbol }),
      metadata: {
        retryAfter,
        rateLimitViolations: this.rateLimitViolations,
        requestsInWindow: this.requestTimes.length
      }
    });

    // Create and record rate limit error
    const rateLimitError = new YahooFinanceError({
      message: `Rate limit exceeded. Retry after ${retryAfter || 'unknown'}ms`,
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
      statusCode: 429,
      context: errorContext,
      suggestedActions: [
        'Wait for rate limit reset',
        'Implement exponential backoff',
        'Use cached data if available',
        'Reduce request frequency'
      ]
    });

    this.errorMonitor.recordError({
      message: rateLimitError.message,
      category: rateLimitError.category,
      severity: rateLimitError.severity,
      retryable: rateLimitError.retryable,
      strategy: rateLimitError.strategy,
      ...(rateLimitError.statusCode !== undefined && { statusCode: rateLimitError.statusCode }),
      context: rateLimitError.context,
      suggestedActions: rateLimitError.suggestedActions
    });

    // Wait for retry-after period or calculated wait time
    const waitTime = retryAfter || this.calculateBackoffDelay();
    console.log(`[RateLimiter] Rate limit exceeded, waiting ${waitTime}ms before retry`);
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Calculate intelligent backoff delay based on violation history
   */
  private calculateBackoffDelay(): number {
    const baseDelay = 60000; // 1 minute base delay
    const violationMultiplier = Math.min(this.rateLimitViolations, 10); // Cap at 10x
    return baseDelay * (1 + violationMultiplier * 0.5); // Increase by 50% per violation
  }

  /**
   * Record rate limit violation for monitoring
   */
  private recordRateLimitViolation(reason: string): void {
    this.rateLimitViolations++;
    
    console.warn(`[RateLimiter] Rate limit violation detected: ${reason}`, {
      violationCount: this.rateLimitViolations,
      requestsInWindow: this.requestTimes.length,
      reason
    });
  }

  /**
   * Reset rate limiter state
   */
  reset(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.requestTimes = [];
    this.rateLimitViolations = 0;
    console.log('[RateLimiter] Rate limiter state reset');
  }

  /**
   * Get rate limiter statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      rateLimitViolations: this.rateLimitViolations,
      currentWindowRequests: this.requestTimes.length,
      isCurrentlyLimited: !this.canMakeRequest(),
      estimatedWaitTime: this.getRateLimit().estimatedWaitTime
    };
  }
}

/**
 * Enhanced Retry Logic with Comprehensive Error Handling
 */
class RetryManager {
  private errorMonitor: ErrorMonitor;

  constructor(private config = RETRY_CONFIG) {
    this.errorMonitor = ErrorMonitor.getInstance();
  }

  /**
   * Execute request with enhanced retry logic and error handling
   */
  async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    context: {
      component: string;
      operation: string;
      url?: string;
      method?: string;
      symbol?: string;
    },
    maxRetries: number = this.config.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error;
    const correlationId = generateCorrelationId();

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await requestFn();
        
        // If we had previous failures but succeeded now, log recovery
        if (attempt > 1) {
          console.log(`[RetryManager] Request succeeded after ${attempt - 1} retries`, {
            correlationId,
            operation: context.operation,
            symbol: context.symbol
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        const errorContext = createErrorContext(context.component, context.operation, {
          correlationId,
          retryAttempt: attempt - 1,
          ...(context.url !== undefined && { url: context.url }),
          ...(context.method !== undefined && { method: context.method }),
          ...(context.symbol !== undefined && { symbol: context.symbol })
        });

        // Classify the error using the comprehensive error handler
        const yahooError = handleError(error as Error, errorContext);
        
        // If this is the last attempt, throw the classified error
        if (attempt > maxRetries) {
          throw yahooError;
        }

        // Check if error should be retried based on comprehensive classification
        if (!shouldRetryError(yahooError)) {
          throw yahooError;
        }

        // Calculate delay using enhanced backoff strategy
        const delay = this.calculateEnhancedDelay(attempt, yahooError);
        
        console.log(`[RetryManager] Attempt ${attempt} failed, retrying in ${delay}ms...`, {
          correlationId,
          errorCategory: yahooError.category,
          errorMessage: yahooError.message,
          nextRetryDelay: delay
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Enhanced delay calculation based on error type and severity
   */
  private calculateEnhancedDelay(attempt: number, error: YahooFinanceError): number {
    let baseDelay = this.config.BASE_DELAY;
    
    // Adjust base delay based on error category
    switch (error.category) {
      case ErrorCategory.RATE_LIMIT:
        // Longer delays for rate limiting
        baseDelay = this.config.BASE_DELAY * 3;
        break;
      case ErrorCategory.NETWORK:
        // Moderate delays for network issues
        baseDelay = this.config.BASE_DELAY * 2;
        break;
      case ErrorCategory.TIMEOUT:
        // Standard delays for timeouts
        baseDelay = this.config.BASE_DELAY;
        break;
      case ErrorCategory.API_ERROR:
        // Shorter delays for API errors (might be temporary)
        baseDelay = this.config.BASE_DELAY * 0.5;
        break;
      default:
        baseDelay = this.config.BASE_DELAY;
    }

    // Apply exponential backoff
    return calculateRetryDelay(
      attempt,
      baseDelay,
      this.config.MAX_DELAY,
      this.config.ENABLE_JITTER
    );
  }

  /**
   * Check if error is retryable (legacy method for backward compatibility)
   */
  isRetryableError(error: AxiosError): boolean {
    // Check HTTP status codes
    if (error.response?.status && this.config.RETRYABLE_STATUS_CODES.includes(error.response.status as any)) {
      return true;
    }

    // Check error types
    if (error.code && this.config.RETRYABLE_ERRORS.includes(error.code as any)) {
      return true;
    }

    // Check specific error conditions
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || 
        error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * Get retry statistics
   */
  getRetryStats() {
    const metrics = this.errorMonitor.getMetrics();
    return {
      totalRetries: metrics.totalErrors,
      retrySuccessRate: metrics.retrySuccessRate,
      averageRetryTime: metrics.averageRecoveryTime,
      errorsByCategory: metrics.errorsByCategory
    };
  }
}

/**
 * Request/Response Logger
 */
class RequestLogger {
  private static instance: RequestLogger;

  static getInstance(): RequestLogger {
    if (!RequestLogger.instance) {
      RequestLogger.instance = new RequestLogger();
    }
    return RequestLogger.instance;
  }

  logRequest(config: AxiosRequestConfig): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] HTTP Request:`, {
      method: config.method?.toUpperCase(),
      url: config.url,
      headers: this.sanitizeHeaders(config.headers),
      timeout: config.timeout
    });
  }

  logResponse(response: AxiosResponse): void {
    const timestamp = new Date().toISOString();
    const duration = (response.config as any).metadata?.startTime 
      ? Date.now() - (response.config as any).metadata.startTime 
      : 0;

    console.log(`[${timestamp}] HTTP Response:`, {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      duration: `${duration}ms`,
      dataSize: JSON.stringify(response.data).length
    });
  }

  logError(error: AxiosError): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] HTTP Error:`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url
    });
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    // Remove sensitive headers
    delete sanitized.Authorization;
    delete sanitized.Cookie;
    delete sanitized['X-API-Key'];
    
    return sanitized;
  }
}

/**
 * Enhanced Yahoo Finance HTTP Client with Comprehensive Error Handling
 */
export class YahooFinanceHttpClient {
  private axiosInstance: AxiosInstance;
  private rateLimiter: RateLimiter;
  private retryManager: RetryManager;
  private logger: RequestLogger;
  private circuitBreaker: CircuitBreaker;
  private errorMonitor: ErrorMonitor;

  constructor() {
    this.rateLimiter = new RateLimiter();
    this.retryManager = new RetryManager();
    this.logger = RequestLogger.getInstance();
    this.errorMonitor = ErrorMonitor.getInstance();
    
    // Initialize circuit breaker with configuration
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitorTimeout: 10000,  // 10 seconds
      minimumRequestThreshold: 3
    });
    
    this.axiosInstance = this.createAxiosInstance();
    this.setupInterceptors();
  }

  /**
   * Create configured axios instance
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: API_ENDPOINTS.BASE_URL,
      timeout: HTTP_CONFIG.TIMEOUT,
      headers: {
        ...HTTP_CONFIG.DEFAULT_HEADERS,
        'User-Agent': HTTP_CONFIG.USER_AGENT
      },
      // Enable keepalive for connection pooling
      httpAgent: undefined, // Will be set up with keep-alive
      httpsAgent: undefined,
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    return instance;
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Add metadata for timing
        (config as any).metadata = { startTime: Date.now() };

        // Check rate limiting
        if (!this.rateLimiter.canMakeRequest()) {
          console.log('Rate limit reached, waiting for next slot...');
          await this.rateLimiter.waitForNextSlot();
        }

        // Record request
        this.rateLimiter.recordRequest();

        // Log request
        this.logger.logRequest(config);

        return config;
      },
      (error) => {
        this.logger.logError(error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.logResponse(response);
        return response;
      },
      (error) => {
        this.logger.logError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make HTTP GET request with comprehensive error handling
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const context = createErrorContext('YahooFinanceHttpClient', 'get', {
      url,
      method: 'GET',
      timeout: config?.timeout || HTTP_CONFIG.TIMEOUT
    });

    try {
      // Execute request with circuit breaker protection
      const response = await this.circuitBreaker.execute(async () => {
        const requestFn = () => this.axiosInstance.get<T>(url, config);
        
        return await this.retryManager.executeWithRetry(
          requestFn,
          {
            component: 'YahooFinanceHttpClient',
            operation: 'get',
            url,
            method: 'GET'
          }
        );
      }, context);
      
      return {
        data: response.data,
        success: true,
        statusCode: response.status,
        timestamp: new Date().toISOString(),
        fromCache: false
      };
    } catch (error) {
      // Handle different error types appropriately
      if (error instanceof YahooFinanceError) {
        const response: ApiResponse<T> = {
          data: null,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        if (error.statusCode !== undefined) {
          response.statusCode = error.statusCode;
        }
        
        // Log detailed error information
        console.error('[YahooFinanceHttpClient] Request failed:', error.toDetailedReport());
        
        return response;
      }

      if (error instanceof HttpClientError) {
        const response: ApiResponse<T> = {
          data: null,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        if (error.statusCode !== undefined) {
          response.statusCode = error.statusCode;
        }
        return response;
      }

      // Handle unknown errors
      const unknownError = handleError(error as Error, context);
      return {
        data: null,
        success: false,
        error: unknownError.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get Yahoo Finance chart data for a symbol with enhanced error handling
   */
  async getChart(
    symbol: string,
    interval: string = '1d',
    range: string = '1mo'
  ): Promise<ApiResponse<YahooFinanceResponse>> {
    const context = createErrorContext('YahooFinanceHttpClient', 'getChart', {
      symbol,
      metadata: { interval, range }
    });

    try {
      // Validate input parameters
      if (!symbol || typeof symbol !== 'string') {
        throw new YahooFinanceError({
          message: `Invalid symbol parameter: ${symbol}`,
          category: ErrorCategory.DATA_VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          retryable: false,
          strategy: RecoveryStrategy.ALERT,
          context,
          suggestedActions: [
            'Provide a valid symbol string',
            'Check symbol format (e.g., CL=F)',
            'Verify symbol exists in Yahoo Finance'
          ]
        });
      }

      const url = `${API_ENDPOINTS.CHART}/${symbol}`;
      const params = {
        interval,
        range,
        includePrePost: false,
        events: 'div,split'
      };

      const response = await this.get<YahooFinanceResponse>(url, { params });
      
      // Validate response structure
      if (response.success && response.data) {
        this.validateChartResponse(response.data, symbol, context);
      }

      return response;
    } catch (error) {
      if (error instanceof YahooFinanceError) {
        throw error;
      }
      
      const enhancedError = handleError(error as Error, context);
      throw enhancedError;
    }
  }

  /**
   * Get current quote data for a symbol with enhanced error handling
   */
  async getQuote(symbol: string): Promise<ApiResponse<any>> {
    const context = createErrorContext('YahooFinanceHttpClient', 'getQuote', {
      symbol
    });

    try {
      // Validate symbol
      if (!symbol || typeof symbol !== 'string') {
        throw new YahooFinanceError({
          message: `Invalid symbol parameter: ${symbol}`,
          category: ErrorCategory.DATA_VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          retryable: false,
          strategy: RecoveryStrategy.ALERT,
          context,
          suggestedActions: [
            'Provide a valid symbol string',
            'Check symbol format',
            'Verify symbol exists'
          ]
        });
      }

      const url = `${API_ENDPOINTS.QUOTE}`;
      const params = { symbols: symbol };

      return await this.get(url, { params });
    } catch (error) {
      if (error instanceof YahooFinanceError) {
        throw error;
      }
      
      const enhancedError = handleError(error as Error, context);
      throw enhancedError;
    }
  }

  /**
   * Search for symbols with enhanced error handling
   */
  async searchSymbols(query: string): Promise<ApiResponse<any>> {
    const context = createErrorContext('YahooFinanceHttpClient', 'searchSymbols', {
      metadata: { query }
    });

    try {
      // Validate query
      if (!query || typeof query !== 'string' || query.trim().length < 1) {
        throw new YahooFinanceError({
          message: `Invalid search query: ${query}`,
          category: ErrorCategory.DATA_VALIDATION,
          severity: ErrorSeverity.LOW,
          retryable: false,
          strategy: RecoveryStrategy.ALERT,
          context,
          suggestedActions: [
            'Provide a non-empty search query',
            'Use at least 1 character',
            'Check query format'
          ]
        });
      }

      const url = API_ENDPOINTS.SEARCH;
      const params = { q: query.trim() };

      return await this.get(url, { params });
    } catch (error) {
      if (error instanceof YahooFinanceError) {
        throw error;
      }
      
      const enhancedError = handleError(error as Error, context);
      throw enhancedError;
    }
  }

  /**
   * Validate chart response structure
   */
  private validateChartResponse(data: YahooFinanceResponse, symbol: string, context: any): void {
    if (!data.chart) {
      throw new YahooFinanceError({
        message: 'Invalid response: missing chart data',
        category: ErrorCategory.DATA_VALIDATION,
        severity: ErrorSeverity.HIGH,
        retryable: false,
        strategy: RecoveryStrategy.ALERT,
        context,
        suggestedActions: [
          'Check Yahoo Finance API status',
          'Verify response format',
          'Report API format change'
        ]
      });
    }

    if (data.chart.error) {
      throw new YahooFinanceError({
        message: `Yahoo Finance API error: ${data.chart.error.description}`,
        category: ErrorCategory.API_ERROR,
        severity: ErrorSeverity.HIGH,
        retryable: false,
        strategy: RecoveryStrategy.ALERT,
        context,
        suggestedActions: [
          'Check symbol validity',
          'Verify market hours',
          'Try alternative symbol format'
        ]
      });
    }

    if (!data.chart.result || data.chart.result.length === 0) {
      throw new YahooFinanceError({
        message: `No data available for symbol: ${symbol}`,
        category: ErrorCategory.DATA_VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        strategy: RecoveryStrategy.RETRY,
        context,
        suggestedActions: [
          'Check if symbol exists',
          'Verify market is open',
          'Try different time range',
          'Use cached data if available'
        ]
      });
    }
  }

  /**
   * Get current rate limit status with enhanced information
   */
  getRateLimit(): RateLimit & { violations: number; estimatedWaitTime: number } {
    return this.rateLimiter.getRateLimit();
  }

  /**
   * Enhanced health check with comprehensive diagnostics
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    checks: {
      connectivity: boolean;
      rateLimit: boolean;
      circuitBreaker: boolean;
      responseTime: number;
    };
    diagnostics: {
      rateLimitStats: any;
      circuitBreakerState: any;
      errorMetrics: any;
      lastError?: string;
    };
  }> {
    const startTime = Date.now();
    const healthStatus = {
      isHealthy: false,
      checks: {
        connectivity: false,
        rateLimit: false,
        circuitBreaker: false,
        responseTime: 0
      },
      diagnostics: {
        rateLimitStats: this.rateLimiter.getStats(),
        circuitBreakerState: this.circuitBreaker.getMetrics(),
        errorMetrics: this.errorMonitor.getMetrics()
      }
    };

    try {
      // Test connectivity with a simple request
      const response = await this.get('/v8/finance/chart/AAPL', { 
        params: { interval: '1d', range: '1d' },
        timeout: 5000 
      });
      
      healthStatus.checks.connectivity = response.success;
      healthStatus.checks.responseTime = Date.now() - startTime;
      
      // Check rate limiting status
      const rateLimitStatus = this.getRateLimit();
      healthStatus.checks.rateLimit = !rateLimitStatus.isLimited;
      
      // Check circuit breaker state
      const circuitState = this.circuitBreaker.getState();
      healthStatus.checks.circuitBreaker = circuitState === 'closed';
      
      // Overall health assessment
      healthStatus.isHealthy = 
        healthStatus.checks.connectivity &&
        healthStatus.checks.rateLimit &&
        healthStatus.checks.circuitBreaker &&
        healthStatus.checks.responseTime < 10000; // 10 seconds threshold
        
    } catch (error) {
      (healthStatus.diagnostics as any).lastError = (error as Error).message;
      healthStatus.checks.responseTime = Date.now() - startTime;
    }

    return healthStatus;
  }

  /**
   * Get comprehensive client diagnostics
   */
  getDiagnostics() {
    return {
      configuration: {
        baseURL: this.axiosInstance.defaults.baseURL,
        timeout: this.axiosInstance.defaults.timeout,
        userAgent: this.axiosInstance.defaults.headers['User-Agent']
      },
      rateLimit: this.rateLimiter.getStats(),
      circuitBreaker: this.circuitBreaker.getMetrics(),
      retryStats: this.retryManager.getRetryStats(),
      errorMetrics: this.errorMonitor.getMetrics(),
      recentErrors: this.errorMonitor.getRecentErrors(30), // Last 30 minutes
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset all client state for recovery
   */
  reset(): void {
    this.rateLimiter.reset();
    this.circuitBreaker.reset();
    this.errorMonitor.clearErrors();
    console.log('[YahooFinanceHttpClient] Client state reset');
  }

  /**
   * Get client performance metrics
   */
  getPerformanceMetrics() {
    const errorMetrics = this.errorMonitor.getMetrics();
    const rateLimitStats = this.rateLimiter.getStats();
    const circuitBreakerMetrics = this.circuitBreaker.getMetrics();

    return {
      uptime: process.uptime() * 1000, // Convert to milliseconds
      totalRequests: rateLimitStats.totalRequests,
      successRate: errorMetrics.totalErrors > 0 
        ? ((rateLimitStats.totalRequests - errorMetrics.totalErrors) / rateLimitStats.totalRequests) * 100 
        : 100,
      averageResponseTime: errorMetrics.averageRecoveryTime,
      errorRate: errorMetrics.totalErrors > 0 
        ? (errorMetrics.totalErrors / rateLimitStats.totalRequests) * 100 
        : 0,
      rateLimitViolations: rateLimitStats.rateLimitViolations,
      circuitBreakerTriggers: errorMetrics.circuitBreakerTriggers,
      failureRate: circuitBreakerMetrics.failureRate,
      isHealthy: circuitBreakerMetrics.state === 'closed' && !rateLimitStats.isCurrentlyLimited
    };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      baseURL: API_ENDPOINTS.BASE_URL,
      timeout: HTTP_CONFIG.TIMEOUT,
      headers: HTTP_CONFIG.DEFAULT_HEADERS,
      userAgent: HTTP_CONFIG.USER_AGENT,
      retryConfig: RETRY_CONFIG,
      rateLimitConfig: RATE_LIMIT_CONFIG
    };
  }

  /**
   * Handle rate limit exceeded scenario
   */
  async handleRateLimitExceeded(retryAfter?: number): Promise<void> {
    await this.rateLimiter.handleRateLimitExceeded({
      component: 'YahooFinanceHttpClient',
      operation: 'handleRateLimitExceeded'
    }, retryAfter);
  }
}

/**
 * Singleton instance
 */
let httpClientInstance: YahooFinanceHttpClient | null = null;

/**
 * Get singleton HTTP client instance
 */
export function getHttpClient(): YahooFinanceHttpClient {
  if (!httpClientInstance) {
    httpClientInstance = new YahooFinanceHttpClient();
  }
  return httpClientInstance;
}

/**
 * Create new HTTP client instance
 */
export function createHttpClient(): YahooFinanceHttpClient {
  return new YahooFinanceHttpClient();
}

/**
 * Export for testing and advanced usage
 */
export { RateLimiter, RetryManager, RequestLogger };

/**
 * Default export
 */
export default YahooFinanceHttpClient;