# Yahoo Finance Integration Error Handling Guide

## Overview

This comprehensive guide covers the error handling system implemented for Yahoo Finance integration components. The system provides robust error detection, classification, recovery, monitoring, and debugging capabilities.

## Table of Contents

1. [Error Handling Architecture](#error-handling-architecture)
2. [Error Categories and Classification](#error-categories-and-classification)
3. [Error Recovery Strategies](#error-recovery-strategies)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Troubleshooting Common Issues](#troubleshooting-common-issues)
6. [Configuration Guide](#configuration-guide)
7. [Best Practices](#best-practices)
8. [API Reference](#api-reference)

## Error Handling Architecture

The error handling system consists of several interconnected components:

### Core Components

1. **Error Handler** (`src/utils/error-handler.ts`)
   - Centralized error classification and handling
   - Circuit breaker pattern implementation
   - Error correlation tracking
   - Recovery strategy determination

2. **HTTP Client** (`src/utils/http-client.ts`)
   - Network error handling with retry logic
   - Rate limiting with exponential backoff
   - Request/response logging and monitoring

3. **Data Validator** (`src/utils/data-validator.ts`)
   - Response structure validation
   - Data quality assessment
   - Malformed data handling

4. **Error Recovery** (`src/utils/error-recovery.ts`)
   - Fallback mechanisms
   - Cache-based recovery
   - Service degradation handling

5. **Error Logger** (`src/utils/error-logger.ts`)
   - Structured logging with correlation IDs
   - Context-aware error tracking
   - Performance impact monitoring

6. **Error Monitoring** (`src/utils/error-monitoring.ts`)
   - Real-time error metrics
   - Alerting and threshold monitoring
   - SLA compliance tracking

### Error Flow

```
Request → HTTP Client → Data Validation → Service Logic
    ↓           ↓              ↓              ↓
Error Handler ← Recovery ← Monitoring ← Logger
    ↓
Response/Recovery
```

## Error Categories and Classification

### Error Categories

1. **NETWORK** - Network connectivity issues
   - DNS resolution failures
   - Connection timeouts
   - Connection refused errors
   - Network unreachable

2. **TIMEOUT** - Request timeout errors
   - HTTP request timeouts
   - Operation timeouts
   - Circuit breaker timeouts

3. **RATE_LIMIT** - API rate limiting
   - 429 Too Many Requests
   - Rate limit exceeded
   - Quota exhausted

4. **AUTHENTICATION** - Authentication failures
   - 401 Unauthorized
   - 403 Forbidden
   - Invalid API keys

5. **API_ERROR** - Yahoo Finance API errors
   - 4xx client errors
   - 5xx server errors
   - Service unavailable

6. **DATA_VALIDATION** - Data integrity issues
   - Invalid response format
   - Missing required fields
   - Data type mismatches

7. **PARSING** - Data parsing errors
   - JSON parsing failures
   - Data transformation errors
   - Format conversion issues

8. **CIRCUIT_BREAKER** - Circuit breaker activation
   - Service protection triggered
   - Failure threshold exceeded

### Error Severity Levels

- **LOW** - Minor issues, system can continue
- **MEDIUM** - Noticeable impact, degraded performance
- **HIGH** - Significant impact, functionality limited
- **CRITICAL** - System failure, immediate attention required

### Recovery Strategies

- **RETRY** - Simple retry with backoff
- **EXPONENTIAL_BACKOFF** - Exponential retry delays
- **FALLBACK** - Use alternative data source
- **CACHE_FALLBACK** - Use cached data
- **CIRCUIT_BREAKER** - Prevent cascade failures
- **DEGRADED_SERVICE** - Limited functionality
- **ALERT** - Notify operators
- **NONE** - No recovery possible

## Error Recovery Strategies

### 1. Retry with Exponential Backoff

```typescript
// Automatic retry for transient errors
const result = await retryManager.executeWithRetry(
  () => httpClient.getChart(symbol),
  {
    component: 'YahooFinanceService',
    operation: 'getChart',
    symbol
  }
);
```

**When Used:**
- Network timeouts
- Temporary server errors (5xx)
- Transient connection issues

**Configuration:**
- Max retries: 3
- Base delay: 1000ms
- Max delay: 30000ms
- Exponential multiplier: 2

### 2. Circuit Breaker Pattern

```typescript
// Protect against cascade failures
const data = await circuitBreaker.execute(async () => {
  return await yahooFinanceAPI.getData(symbol);
}, errorContext);
```

**States:**
- **CLOSED** - Normal operation
- **OPEN** - Blocking requests (failures exceed threshold)
- **HALF_OPEN** - Testing if service recovered

**Configuration:**
- Failure threshold: 5 failures
- Recovery timeout: 60 seconds
- Monitor timeout: 10 seconds

### 3. Cache Fallback

```typescript
// Use cached data when API fails
if (apiError.category === ErrorCategory.NETWORK) {
  const cachedData = cache.get(cacheKey);
  if (cachedData && !isExpired(cachedData)) {
    return cachedData;
  }
}
```

**Cache Strategy:**
- 5-minute TTL for real-time data
- 30-minute TTL for historical data
- LRU eviction policy
- Size limit: 100MB

### 4. Service Degradation

```typescript
// Provide limited functionality
if (errorSeverity === ErrorSeverity.HIGH) {
  return provideDegradedService({
    basicPriceOnly: true,
    noHistoricalData: true,
    warningMessage: "Limited data available"
  });
}
```

**Degradation Levels:**
- **NONE** - Full functionality
- **MINOR** - Slight delays
- **MODERATE** - Limited features
- **SEVERE** - Basic functionality only
- **CRITICAL** - Emergency mode

## Monitoring and Alerting

### Alert Types

1. **Error Rate Threshold**
   - Trigger: >10 errors/minute
   - Severity: HIGH
   - Cooldown: 5 minutes

2. **Consecutive Failures**
   - Trigger: ≥5 consecutive failures
   - Severity: CRITICAL
   - Cooldown: 10 minutes

3. **High Latency**
   - Trigger: >10 seconds average response time
   - Severity: MEDIUM
   - Cooldown: 15 minutes

4. **Circuit Breaker Open**
   - Trigger: Any circuit breaker opens
   - Severity: CRITICAL
   - Immediate notification

### Metrics Tracked

- Error rate (errors per minute)
- Success rate percentage
- Average response time
- P95/P99 response times
- Circuit breaker status
- Rate limiting violations
- Data quality scores
- System availability

### SLA Monitoring

- **Target Availability**: 99.5%
- **Target Error Rate**: <5 errors/hour
- **Target Response Time**: <5 seconds average
- **Measurement Window**: 1 hour

## Troubleshooting Common Issues

### Network Connectivity Issues

**Symptoms:**
- `ENOTFOUND` DNS errors
- `ECONNREFUSED` connection errors
- `ETIMEDOUT` timeout errors

**Diagnosis:**
```typescript
// Check error context
if (error.category === ErrorCategory.NETWORK) {
  console.log('Network error details:', {
    code: error.originalError?.code,
    message: error.message,
    url: error.context.url,
    correlationId: error.context.correlationId
  });
}
```

**Solutions:**
1. Check internet connectivity
2. Verify DNS settings
3. Check firewall/proxy configuration
4. Validate Yahoo Finance endpoint URLs
5. Increase timeout values if needed

### Rate Limiting Issues

**Symptoms:**
- HTTP 429 responses
- "Rate limit exceeded" errors
- Requests being blocked

**Diagnosis:**
```typescript
const rateLimitStatus = httpClient.getRateLimit();
console.log('Rate limit status:', {
  remaining: rateLimitStatus.remaining,
  resetTime: new Date(rateLimitStatus.resetTime),
  violations: rateLimitStatus.violations,
  isLimited: rateLimitStatus.isLimited
});
```

**Solutions:**
1. Implement request throttling
2. Use caching to reduce API calls
3. Implement exponential backoff
4. Consider upgrading API plan
5. Distribute requests across time

### Data Validation Failures

**Symptoms:**
- "Invalid response format" errors
- Missing required fields
- Data type mismatches

**Diagnosis:**
```typescript
const validationResult = validateYahooFinanceResponse(response, {
  symbol,
  operation: 'getChart',
  component: 'YahooFinanceService'
});

console.log('Validation issues:', {
  errors: validationResult.errors,
  warnings: validationResult.warnings,
  qualityScore: validationResult.qualityScore
});
```

**Solutions:**
1. Check Yahoo Finance API status
2. Verify symbol format (e.g., 'CL=F' for futures)
3. Update data validation schemas
4. Implement data sanitization
5. Use fallback data sources

### Circuit Breaker Activation

**Symptoms:**
- "Circuit breaker is open" errors
- Requests being blocked
- Service unavailable messages

**Diagnosis:**
```typescript
const cbMetrics = circuitBreaker.getMetrics();
console.log('Circuit breaker state:', {
  state: cbMetrics.state,
  failureCount: cbMetrics.failureCount,
  failureRate: cbMetrics.failureRate,
  requestCount: cbMetrics.requestCount
});
```

**Solutions:**
1. Wait for automatic recovery (60 seconds)
2. Check underlying service health
3. Manually reset circuit breaker if needed
4. Use cached data or degraded service
5. Investigate root cause of failures

### High Memory Usage

**Symptoms:**
- Increasing memory consumption
- Out of memory errors
- Performance degradation

**Diagnosis:**
```typescript
const stats = errorLogger.getStats();
console.log('Logger statistics:', {
  bufferSize: stats.bufferSize,
  memoryUsage: stats.memoryUsage,
  totalLogs: stats.totalLogs
});
```

**Solutions:**
1. Flush log buffers more frequently
2. Reduce log retention period
3. Clear error monitoring history
4. Implement log rotation
5. Increase available memory

## Configuration Guide

### HTTP Client Configuration

```typescript
const httpConfig = {
  timeout: 15000,           // 15 second timeout
  maxRetries: 3,            // Maximum retry attempts
  baseDelay: 1000,          // Base retry delay (1 second)
  maxDelay: 30000,          // Maximum retry delay (30 seconds)
  enableJitter: true,       // Add randomness to retries
  rateLimit: {
    enabled: true,
    requestsPerMinute: 120,
    burstLimit: 10
  }
};
```

### Circuit Breaker Configuration

```typescript
const circuitBreakerConfig = {
  failureThreshold: 5,      // Open after 5 failures
  recoveryTimeout: 60000,   // Try recovery after 60 seconds
  monitorTimeout: 10000,    // Monitor for 10 seconds
  minimumRequestThreshold: 3 // Minimum requests before triggering
};
```

### Logging Configuration

```typescript
const loggerConfig = {
  level: LogLevel.INFO,
  destinations: [LogDestination.CONSOLE, LogDestination.FILE],
  includeStackTrace: true,
  maskSensitiveData: true,
  maxEntrySize: 10000,      // 10KB per log entry
  bufferSize: 100,          // Buffer 100 entries
  flushInterval: 5000       // Flush every 5 seconds
};
```

### Monitoring Configuration

```typescript
const monitoringConfig = {
  checkInterval: 30000,     // Check alerts every 30 seconds
  metricsInterval: 60000,   // Collect metrics every minute
  slaCheckInterval: 300000, // Check SLA every 5 minutes
  maxAlertHistory: 1000     // Keep 1000 historical alerts
};
```

## Best Practices

### Error Handling

1. **Always provide context**
   ```typescript
   const context = createErrorContext('YahooFinanceService', 'getPrice', {
     symbol,
     correlationId,
     timeout: 10000
   });
   ```

2. **Use specific error types**
   ```typescript
   throw new YahooFinanceError({
     message: 'Invalid symbol format',
     category: ErrorCategory.DATA_VALIDATION,
     severity: ErrorSeverity.MEDIUM,
     retryable: false,
     context,
     suggestedActions: ['Check symbol format', 'Verify symbol exists']
   });
   ```

3. **Implement proper retry logic**
   ```typescript
   // Good: Use exponential backoff
   const delay = calculateRetryDelay(attempt, baseDelay, maxDelay, true);
   
   // Bad: Fixed delay
   await new Promise(resolve => setTimeout(resolve, 1000));
   ```

### Monitoring

1. **Track correlation IDs**
   ```typescript
   const correlationId = logOperationStart('HttpClient', 'getChart', { symbol });
   // ... operation ...
   logOperationEnd(correlationId, success, duration);
   ```

2. **Set appropriate alert thresholds**
   ```typescript
   // Good: Reasonable thresholds
   errorRateThreshold: 10,  // 10 errors per minute
   
   // Bad: Too sensitive
   errorRateThreshold: 1,   // 1 error per minute
   ```

3. **Monitor data quality**
   ```typescript
   const validationResult = validateResponse(response);
   if (validationResult.qualityScore < 0.8) {
     logger.warn('Low data quality detected', { qualityScore });
   }
   ```

### Recovery

1. **Use appropriate fallback strategies**
   ```typescript
   // Network errors: Retry with backoff
   if (error.category === ErrorCategory.NETWORK) {
     return RecoveryStrategy.EXPONENTIAL_BACKOFF;
   }
   
   // Rate limiting: Use cache
   if (error.category === ErrorCategory.RATE_LIMIT) {
     return RecoveryStrategy.CACHE_FALLBACK;
   }
   ```

2. **Implement graceful degradation**
   ```typescript
   if (error.severity >= ErrorSeverity.HIGH) {
     return {
       data: getCachedData(),
       warning: 'Using cached data due to service issues',
       isDegraded: true
     };
   }
   ```

### Performance

1. **Cache aggressively**
   ```typescript
   // Cache successful responses
   if (response.success) {
     errorRecovery.cacheData(cacheKey, response.data, DataQuality.HIGH);
   }
   ```

2. **Use circuit breakers**
   ```typescript
   // Protect downstream services
   const result = await circuitBreaker.execute(operation, context);
   ```

3. **Monitor performance impact**
   ```typescript
   const startTime = Date.now();
   // ... operation ...
   const duration = Date.now() - startTime;
   logPerformance('getChart', duration, { symbol });
   ```

## API Reference

### Core Error Classes

#### YahooFinanceError

```typescript
class YahooFinanceError extends Error {
  constructor(errorInfo: ErrorInfo);
  
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly recoveryStrategy: RecoveryStrategy;
  readonly context: ErrorContext;
  
  toDetailedReport(): string;
}
```

#### ErrorRecoveryManager

```typescript
class ErrorRecoveryManager {
  constructor(config: RecoveryStrategyConfig);
  
  async recoverFromError<T>(
    originalError: YahooFinanceError,
    operation: () => Promise<T>,
    context: RecoveryContext
  ): Promise<RecoveryResult<T>>;
  
  cacheData<T>(key: string, data: T, quality: DataQuality): void;
  getRecoveryStats(): RecoveryStats;
  reset(): void;
}
```

#### StructuredLogger

```typescript
class StructuredLogger {
  static getInstance(config?: LoggerConfig): StructuredLogger;
  
  trace(message: string, context?: ErrorContext, metadata?: any): void;
  debug(message: string, context?: ErrorContext, metadata?: any): void;
  info(message: string, context?: ErrorContext, metadata?: any): void;
  warn(message: string, context?: ErrorContext, metadata?: any): void;
  error(message: string, error?: Error, context?: ErrorContext, metadata?: any): void;
  fatal(message: string, error?: Error, context?: ErrorContext, metadata?: any): void;
  
  startOperation(component: string, operation: string, context?: ErrorContext): string;
  endOperation(correlationId: string, success: boolean, duration?: number): void;
  
  queryLogs(filter: LogFilter, limit?: number, offset?: number): LogEntry[];
  aggregateLogs(filter?: LogFilter, timeRange?: TimeRange): LogAggregation;
}
```

#### ErrorMonitoringSystem

```typescript
class ErrorMonitoringSystem {
  static getInstance(): ErrorMonitoringSystem;
  
  addAlertConfig(config: AlertConfig): void;
  addSLAConfig(config: SLAConfig): void;
  registerHealthCheck(name: string, checkFn: () => Promise<boolean>): void;
  
  getMetrics(): MonitoringMetrics;
  getActiveAlerts(): Alert[];
  getSLAStatus(): SLAStatus[];
  
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean;
  resolveAlert(alertId: string, resolvedBy?: string): boolean;
  
  getDashboardData(): DashboardData;
}
```

### Utility Functions

```typescript
// Error handling utilities
function createErrorContext(component: string, operation: string, overrides?: Partial<ErrorContext>): ErrorContext;
function handleError(error: Error, context: ErrorContext): YahooFinanceError;
function shouldRetryError(error: YahooFinanceError): boolean;
function calculateRetryDelay(attempt: number, baseDelay?: number, maxDelay?: number, jitter?: boolean): number;

// Validation utilities
function validateYahooFinanceResponse(response: any, context: ValidationContext): DataValidationResult;

// Logging utilities
function getLogger(): StructuredLogger;
function logOperationStart(component: string, operation: string, context?: ErrorContext): string;
function logOperationEnd(correlationId: string, success: boolean, duration?: number): void;
function logYahooFinanceError(error: YahooFinanceError, context?: any): void;

// Monitoring utilities
function getMonitoringSystem(): ErrorMonitoringSystem;
function initializeMonitoring(): ErrorMonitoringSystem;
```

## Error Codes Reference

### Common Error Patterns

| Error Code | Category | Description | Recovery Strategy |
|------------|----------|-------------|-------------------|
| `NETWORK_ERROR` | NETWORK | Network connectivity issue | Retry with backoff |
| `TIMEOUT_ERROR` | TIMEOUT | Request timeout | Retry, increase timeout |
| `RATE_LIMIT_ERROR` | RATE_LIMIT | API rate limit exceeded | Wait, use cache |
| `API_ERROR` | API_ERROR | Yahoo Finance API error | Retry, alternative source |
| `INVALID_SYMBOL` | DATA_VALIDATION | Invalid symbol format | Alert, fix symbol |
| `DATA_PARSING_ERROR` | PARSING | Failed to parse response | Alternative source |
| `CIRCUIT_BREAKER_OPEN` | CIRCUIT_BREAKER | Circuit breaker triggered | Wait, use cache |

### HTTP Status Code Mapping

| Status Code | Category | Severity | Retryable |
|-------------|----------|----------|-----------|
| 400 | API_ERROR | MEDIUM | No |
| 401 | AUTHENTICATION | HIGH | No |
| 403 | AUTHENTICATION | HIGH | No |
| 404 | API_ERROR | MEDIUM | No |
| 429 | RATE_LIMIT | MEDIUM | Yes |
| 500 | API_ERROR | HIGH | Yes |
| 502 | API_ERROR | HIGH | Yes |
| 503 | API_ERROR | HIGH | Yes |
| 504 | TIMEOUT | MEDIUM | Yes |

## Support and Maintenance

### Monitoring Dashboard

Access the monitoring dashboard to view:
- Real-time error metrics
- Active alerts and their status
- SLA compliance tracking
- System health indicators
- Error trends and patterns

### Log Analysis

Query logs using filters:
```typescript
const recentErrors = logger.queryLogs({
  level: { min: LogLevel.ERROR, max: LogLevel.FATAL },
  component: 'YahooFinanceService',
  symbol: 'CL=F'
}, 100);
```

### Alert Management

Manage alerts programmatically:
```typescript
const monitoring = getMonitoringSystem();
const activeAlerts = monitoring.getActiveAlerts();
monitoring.acknowledgeAlert(alertId, 'operator@company.com');
monitoring.resolveAlert(alertId, 'operator@company.com');
```

For additional support or questions about the error handling system, please refer to the team documentation or contact the development team.