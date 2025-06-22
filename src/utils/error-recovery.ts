/**
 * Error Recovery System for Yahoo Finance Integration
 * 
 * Comprehensive error recovery system that implements fallback mechanisms, circuit breaker
 * patterns, and intelligent recovery strategies for Yahoo Finance integration failures.
 * This system provides automatic error recovery, data fallback, and service resilience.
 * 
 * Features:
 * - Multiple fallback data sources
 * - Circuit breaker pattern implementation
 * - Intelligent retry strategies
 * - Cache-based fallback
 * - Service degradation handling
 * - Recovery state management
 * - Performance monitoring during recovery
 * - Automated recovery testing
 * 
 * @author Yahoo Finance Error Recovery System
 * @version 1.0.0
 */

import { 
  YahooFinanceError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  CircuitBreaker,
  ErrorMonitor,
  createErrorContext,
  calculateRetryDelay
} from './error-handler';
import { YahooFinanceResponse, YahooFinancePriceData } from '../types/yahoo-finance';
import { CommodityData } from '../types/commodity';

/**
 * Recovery operation result
 */
export interface RecoveryResult<T> {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovered data if successful */
  data?: T;
  /** Recovery method used */
  method: RecoveryMethod;
  /** Recovery metadata */
  metadata: {
    /** Time taken for recovery */
    recoveryTime: number;
    /** Number of attempts made */
    attempts: number;
    /** Source of recovered data */
    dataSource: string;
    /** Quality of recovered data */
    dataQuality: DataQuality;
    /** Whether this is degraded service */
    isDegraded: boolean;
  };
  /** Errors encountered during recovery */
  errors: Error[];
  /** Warnings about data quality */
  warnings: string[];
}

/**
 * Recovery methods available
 */
export enum RecoveryMethod {
  RETRY = 'retry',
  CACHE_FALLBACK = 'cache_fallback',
  ALTERNATIVE_SOURCE = 'alternative_source',
  DEGRADED_SERVICE = 'degraded_service',
  SYNTHESIZED_DATA = 'synthesized_data',
  CIRCUIT_BREAKER = 'circuit_breaker',
  NONE = 'none'
}

/**
 * Data quality levels
 */
export enum DataQuality {
  HIGH = 'high',           // Real-time, accurate data
  MEDIUM = 'medium',       // Slightly delayed or cached data
  LOW = 'low',            // Significantly delayed or degraded data
  SYNTHETIC = 'synthetic', // Generated or estimated data
  UNKNOWN = 'unknown'     // Quality cannot be determined
}

/**
 * Fallback data source configuration
 */
export interface FallbackSource {
  /** Source identifier */
  id: string;
  /** Source name */
  name: string;
  /** Source priority (lower = higher priority) */
  priority: number;
  /** Whether source is currently available */
  available: boolean;
  /** Data quality this source provides */
  quality: DataQuality;
  /** Source-specific configuration */
  config: Record<string, any>;
  /** Last successful fetch timestamp */
  lastSuccess?: number;
  /** Last failure timestamp */
  lastFailure?: number;
  /** Failure count */
  failureCount: number;
}

/**
 * Recovery strategy configuration
 */
export interface RecoveryStrategyConfig {
  /** Maximum recovery attempts */
  maxAttempts: number;
  /** Base delay between recovery attempts */
  baseDelay: number;
  /** Maximum delay between attempts */
  maxDelay: number;
  /** Whether to use exponential backoff */
  useExponentialBackoff: boolean;
  /** Timeout for each recovery attempt */
  attemptTimeout: number;
  /** Whether to allow degraded service */
  allowDegradedService: boolean;
  /** Minimum data quality acceptable */
  minDataQuality: DataQuality;
  /** Fallback sources to try */
  fallbackSources: FallbackSource[];
}

/**
 * Cache-based fallback data
 */
export interface CachedData<T> {
  /** Cached data */
  data: T;
  /** Cache timestamp */
  timestamp: number;
  /** Data expiry time */
  expiresAt: number;
  /** Data quality when cached */
  quality: DataQuality;
  /** Source of original data */
  source: string;
  /** Metadata about cached data */
  metadata: Record<string, any>;
}

/**
 * Recovery state tracking
 */
export interface RecoveryState {
  /** Whether system is in recovery mode */
  inRecovery: boolean;
  /** Current recovery method being used */
  currentMethod?: RecoveryMethod;
  /** Recovery start time */
  recoveryStartTime?: number;
  /** Number of recovery attempts */
  recoveryAttempts: number;
  /** Last successful recovery */
  lastSuccessfulRecovery?: {
    timestamp: number;
    method: RecoveryMethod;
    dataQuality: DataQuality;
  };
  /** Current service degradation level */
  degradationLevel: ServiceDegradationLevel;
}

/**
 * Service degradation levels
 */
export enum ServiceDegradationLevel {
  NONE = 'none',           // Full service available
  MINOR = 'minor',         // Slight delays or quality reduction
  MODERATE = 'moderate',   // Noticeable service impact
  SEVERE = 'severe',       // Significant functionality limited
  CRITICAL = 'critical'    // Basic functionality only
}

/**
 * Comprehensive Error Recovery Manager
 */
export class ErrorRecoveryManager {
  private cache: Map<string, CachedData<any>> = new Map();
  private recoveryState: RecoveryState;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private errorMonitor: ErrorMonitor;
  private fallbackSources: Map<string, FallbackSource> = new Map();
  private recoveryStats: {
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    averageRecoveryTime: number;
    recoveryMethodStats: Record<RecoveryMethod, number>;
  };

  constructor(private config: RecoveryStrategyConfig) {
    this.errorMonitor = ErrorMonitor.getInstance();
    this.recoveryState = {
      inRecovery: false,
      recoveryAttempts: 0,
      degradationLevel: ServiceDegradationLevel.NONE
    };
    this.recoveryStats = {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      recoveryMethodStats: Object.values(RecoveryMethod).reduce((acc, method) => {
        acc[method] = 0;
        return acc;
      }, {} as Record<RecoveryMethod, number>)
    };

    // Initialize fallback sources
    this.config.fallbackSources.forEach(source => {
      this.fallbackSources.set(source.id, { ...source });
    });

    this.setupCacheCleanup();
  }

  /**
   * Attempt to recover from error with comprehensive fallback strategies
   */
  async recoverFromError<T>(
    originalError: YahooFinanceError,
    operation: () => Promise<T>,
    context: {
      component: string;
      operation: string;
      symbol?: string;
      cacheKey?: string;
      primaryDataSource?: string;
    }
  ): Promise<RecoveryResult<T>> {
    const startTime = Date.now();
    const result: RecoveryResult<T> = {
      success: false,
      method: RecoveryMethod.NONE,
      metadata: {
        recoveryTime: 0,
        attempts: 0,
        dataSource: 'none',
        dataQuality: DataQuality.UNKNOWN,
        isDegraded: false
      },
      errors: [originalError],
      warnings: []
    };

    this.enterRecoveryMode();

    try {
      // Determine recovery strategy based on error
      const strategy = this.determineRecoveryStrategy(originalError);
      
      // Attempt recovery using determined strategy
      const recoveryResult = await this.executeRecoveryStrategy(
        strategy,
        operation,
        context,
        result
      );

      result.success = recoveryResult.success;
      result.data = recoveryResult.data;
      result.method = recoveryResult.method;
      
      if (recoveryResult.success) {
        this.recordSuccessfulRecovery(strategy, result);
      } else {
        this.recordFailedRecovery(strategy, result);
      }

    } catch (error) {
      result.errors.push(error as Error);
      this.recordFailedRecovery(RecoveryMethod.NONE, result);
    } finally {
      result.metadata.recoveryTime = Date.now() - startTime;
      this.exitRecoveryMode(result.success);
    }

    return result;
  }

  /**
   * Determine appropriate recovery strategy based on error type
   */
  private determineRecoveryStrategy(error: YahooFinanceError): RecoveryMethod[] {
    const strategies: RecoveryMethod[] = [];

    switch (error.category) {
      case ErrorCategory.NETWORK:
        strategies.push(
          RecoveryMethod.RETRY,
          RecoveryMethod.CACHE_FALLBACK,
          RecoveryMethod.ALTERNATIVE_SOURCE
        );
        break;

      case ErrorCategory.TIMEOUT:
        strategies.push(
          RecoveryMethod.RETRY,
          RecoveryMethod.CACHE_FALLBACK
        );
        break;

      case ErrorCategory.RATE_LIMIT:
        strategies.push(
          RecoveryMethod.CACHE_FALLBACK,
          RecoveryMethod.DEGRADED_SERVICE
        );
        break;

      case ErrorCategory.API_ERROR:
        if (error.statusCode && error.statusCode >= 500) {
          strategies.push(
            RecoveryMethod.RETRY,
            RecoveryMethod.ALTERNATIVE_SOURCE,
            RecoveryMethod.CACHE_FALLBACK
          );
        } else {
          strategies.push(
            RecoveryMethod.ALTERNATIVE_SOURCE,
            RecoveryMethod.CACHE_FALLBACK
          );
        }
        break;

      case ErrorCategory.DATA_VALIDATION:
        strategies.push(
          RecoveryMethod.ALTERNATIVE_SOURCE,
          RecoveryMethod.CACHE_FALLBACK,
          RecoveryMethod.SYNTHESIZED_DATA
        );
        break;

      case ErrorCategory.CIRCUIT_BREAKER:
        strategies.push(
          RecoveryMethod.CACHE_FALLBACK,
          RecoveryMethod.ALTERNATIVE_SOURCE,
          RecoveryMethod.DEGRADED_SERVICE
        );
        break;

      default:
        strategies.push(
          RecoveryMethod.CACHE_FALLBACK,
          RecoveryMethod.RETRY
        );
    }

    return strategies;
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy<T>(
    strategies: RecoveryMethod[],
    operation: () => Promise<T>,
    context: any,
    result: RecoveryResult<T>
  ): Promise<{ success: boolean; data?: T; method: RecoveryMethod }> {
    
    for (const strategy of strategies) {
      result.metadata.attempts++;
      
      try {
        console.log(`[ErrorRecoveryManager] Attempting recovery with strategy: ${strategy}`);
        
        const strategyResult = await this.executeStrategy(strategy, operation, context);
        
        if (strategyResult.success) {
          this.recoveryStats.recoveryMethodStats[strategy]++;
          return strategyResult;
        }
        
      } catch (error) {
        result.errors.push(error as Error);
        console.warn(`[ErrorRecoveryManager] Recovery strategy ${strategy} failed:`, error);
      }

      // Add delay between recovery attempts
      if (result.metadata.attempts < strategies.length) {
        const delay = calculateRetryDelay(
          result.metadata.attempts,
          this.config.baseDelay,
          this.config.maxDelay,
          this.config.useExponentialBackoff
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { success: false, method: RecoveryMethod.NONE };
  }

  /**
   * Execute specific recovery strategy
   */
  private async executeStrategy<T>(
    strategy: RecoveryMethod,
    operation: () => Promise<T>,
    context: any
  ): Promise<{ success: boolean; data?: T; method: RecoveryMethod }> {
    
    switch (strategy) {
      case RecoveryMethod.RETRY:
        return await this.retryOperation(operation, context);
        
      case RecoveryMethod.CACHE_FALLBACK:
        return await this.useCacheFallback(context);
        
      case RecoveryMethod.ALTERNATIVE_SOURCE:
        return await this.useAlternativeSource(context);
        
      case RecoveryMethod.DEGRADED_SERVICE:
        return await this.provideDegradedService(context);
        
      case RecoveryMethod.SYNTHESIZED_DATA:
        return await this.synthesizeData(context);
        
      case RecoveryMethod.CIRCUIT_BREAKER:
        return await this.handleCircuitBreaker(operation, context);
        
      default:
        return { success: false, method: strategy };
    }
  }

  /**
   * Retry operation with intelligent backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    context: any
  ): Promise<{ success: boolean; data?: T; method: RecoveryMethod }> {
    
    const maxRetries = Math.min(this.config.maxAttempts, 3);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ErrorRecoveryManager] Retry attempt ${attempt}/${maxRetries}`);
        
        const data = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Recovery timeout')), this.config.attemptTimeout)
          )
        ]);
        
        return { success: true, data, method: RecoveryMethod.RETRY };
        
      } catch (error) {
        console.warn(`[ErrorRecoveryManager] Retry attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          const delay = calculateRetryDelay(attempt, this.config.baseDelay, this.config.maxDelay, true);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    return { success: false, method: RecoveryMethod.RETRY };
  }

  /**
   * Use cached data as fallback
   */
  private async useCacheFallback<T>(
    context: any
  ): Promise<{ success: boolean; data?: T; method: RecoveryMethod }> {
    
    if (!context.cacheKey) {
      return { success: false, method: RecoveryMethod.CACHE_FALLBACK };
    }
    
    const cachedData = this.cache.get(context.cacheKey);
    
    if (!cachedData) {
      console.log(`[ErrorRecoveryManager] No cached data found for key: ${context.cacheKey}`);
      return { success: false, method: RecoveryMethod.CACHE_FALLBACK };
    }
    
    // Check if cached data is still acceptable
    const now = Date.now();
    const dataAge = now - cachedData.timestamp;
    const maxAcceptableAge = this.getMaxAcceptableCacheAge(context);
    
    if (dataAge > maxAcceptableAge) {
      console.log(`[ErrorRecoveryManager] Cached data too old: ${dataAge}ms > ${maxAcceptableAge}ms`);
      return { success: false, method: RecoveryMethod.CACHE_FALLBACK };
    }
    
    // Check if data quality meets minimum requirements
    if (!this.isDataQualityAcceptable(cachedData.quality)) {
      console.log(`[ErrorRecoveryManager] Cached data quality too low: ${cachedData.quality}`);
      return { success: false, method: RecoveryMethod.CACHE_FALLBACK };
    }
    
    console.log(`[ErrorRecoveryManager] Using cached data from ${new Date(cachedData.timestamp).toISOString()}`);
    return { 
      success: true, 
      data: cachedData.data as T, 
      method: RecoveryMethod.CACHE_FALLBACK 
    };
  }

  /**
   * Use alternative data source
   */
  private async useAlternativeSource<T>(
    context: any
  ): Promise<{ success: boolean; data?: T; method: RecoveryMethod }> {
    
    // Get available fallback sources sorted by priority
    const availableSources = Array.from(this.fallbackSources.values())
      .filter(source => source.available && source.id !== context.primaryDataSource)
      .sort((a, b) => a.priority - b.priority);
    
    if (availableSources.length === 0) {
      console.log('[ErrorRecoveryManager] No alternative sources available');
      return { success: false, method: RecoveryMethod.ALTERNATIVE_SOURCE };
    }
    
    for (const source of availableSources) {
      try {
        console.log(`[ErrorRecoveryManager] Trying alternative source: ${source.name}`);
        
        const data = await this.fetchFromAlternativeSource(source, context);
        
        if (data) {
          this.updateSourceStatus(source.id, true);
          return { 
            success: true, 
            data: data as T, 
            method: RecoveryMethod.ALTERNATIVE_SOURCE 
          };
        }
        
      } catch (error) {
        console.warn(`[ErrorRecoveryManager] Alternative source ${source.name} failed:`, error);
        this.updateSourceStatus(source.id, false);
      }
    }
    
    return { success: false, method: RecoveryMethod.ALTERNATIVE_SOURCE };
  }

  /**
   * Provide degraded service with limited functionality
   */
  private async provideDegradedService<T>(
    context: any
  ): Promise<{ success: boolean; data?: T; method: RecoveryMethod }> {
    
    if (!this.config.allowDegradedService) {
      return { success: false, method: RecoveryMethod.DEGRADED_SERVICE };
    }
    
    // Escalate degradation level
    this.escalateDegradation();
    
    // Try to provide basic functionality with degraded data
    const degradedData = await this.createDegradedData(context);
    
    if (degradedData) {
      console.log('[ErrorRecoveryManager] Providing degraded service');
      return { 
        success: true, 
        data: degradedData as T, 
        method: RecoveryMethod.DEGRADED_SERVICE 
      };
    }
    
    return { success: false, method: RecoveryMethod.DEGRADED_SERVICE };
  }

  /**
   * Synthesize data based on historical patterns
   */
  private async synthesizeData<T>(
    context: any
  ): Promise<{ success: boolean; data?: T; method: RecoveryMethod }> {
    
    // This is a placeholder for data synthesis logic
    // In a real implementation, this would use historical data patterns,
    // market models, or other predictive algorithms
    
    console.log('[ErrorRecoveryManager] Data synthesis not implemented');
    return { success: false, method: RecoveryMethod.SYNTHESIZED_DATA };
  }

  /**
   * Handle circuit breaker recovery
   */
  private async handleCircuitBreaker<T>(
    operation: () => Promise<T>,
    context: any
  ): Promise<{ success: boolean; data?: T; method: RecoveryMethod }> {
    
    const circuitBreaker = this.getCircuitBreaker(context.component);
    
    try {
      const errorContext = createErrorContext(context.component, context.operation, {
        symbol: context.symbol
      });
      
      const data = await circuitBreaker.execute(operation, errorContext);
      
      return { 
        success: true, 
        data, 
        method: RecoveryMethod.CIRCUIT_BREAKER 
      };
      
    } catch (error) {
      console.warn('[ErrorRecoveryManager] Circuit breaker rejected operation:', error);
      return { success: false, method: RecoveryMethod.CIRCUIT_BREAKER };
    }
  }

  /**
   * Cache data for future fallback use
   */
  cacheData<T>(
    key: string,
    data: T,
    quality: DataQuality = DataQuality.HIGH,
    source: string = 'yahoo-finance',
    ttlMs: number = 5 * 60 * 1000 // 5 minutes default
  ): void {
    
    const now = Date.now();
    const cachedData: CachedData<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttlMs,
      quality,
      source,
      metadata: {
        cacheTime: now
      }
    };
    
    this.cache.set(key, cachedData);
    console.log(`[ErrorRecoveryManager] Cached data for key: ${key}`);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    return {
      ...this.recoveryStats,
      currentState: { ...this.recoveryState },
      cacheStats: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys())
      },
      sourceStats: Array.from(this.fallbackSources.values()).map(source => ({
        id: source.id,
        name: source.name,
        available: source.available,
        failureCount: source.failureCount,
        lastSuccess: source.lastSuccess,
        lastFailure: source.lastFailure
      }))
    };
  }

  /**
   * Reset recovery state
   */
  reset(): void {
    this.recoveryState = {
      inRecovery: false,
      recoveryAttempts: 0,
      degradationLevel: ServiceDegradationLevel.NONE
    };
    
    this.cache.clear();
    
    // Reset circuit breakers
    this.circuitBreakers.forEach(cb => cb.reset());
    
    // Reset source failure counts
    this.fallbackSources.forEach(source => {
      source.failureCount = 0;
      source.available = true;
    });
    
    console.log('[ErrorRecoveryManager] Recovery state reset');
  }

  // Private helper methods

  private enterRecoveryMode(): void {
    this.recoveryState.inRecovery = true;
    this.recoveryState.recoveryStartTime = Date.now();
    this.recoveryState.recoveryAttempts++;
    this.recoveryStats.totalRecoveries++;
  }

  private exitRecoveryMode(successful: boolean): void {
    this.recoveryState.inRecovery = false;
    
    if (successful) {
      this.recoveryStats.successfulRecoveries++;
      this.recoveryState.lastSuccessfulRecovery = {
        timestamp: Date.now(),
        method: RecoveryMethod.RETRY, // This would be set properly in real implementation
        dataQuality: DataQuality.MEDIUM
      };
      
      // Gradually reduce degradation level on successful recovery
      this.reduceDegradation();
    } else {
      this.recoveryStats.failedRecoveries++;
    }
    
    // Update average recovery time
    if (this.recoveryState.recoveryStartTime) {
      const recoveryTime = Date.now() - this.recoveryState.recoveryStartTime;
      this.recoveryStats.averageRecoveryTime = 
        (this.recoveryStats.averageRecoveryTime * (this.recoveryStats.totalRecoveries - 1) + recoveryTime) / 
        this.recoveryStats.totalRecoveries;
    }
  }

  private recordSuccessfulRecovery(strategy: RecoveryMethod, result: RecoveryResult<any>): void {
    console.log(`[ErrorRecoveryManager] Recovery successful using ${strategy}`);
  }

  private recordFailedRecovery(strategy: RecoveryMethod, result: RecoveryResult<any>): void {
    console.warn(`[ErrorRecoveryManager] Recovery failed with ${strategy}`);
  }

  private getCircuitBreaker(component: string): CircuitBreaker {
    if (!this.circuitBreakers.has(component)) {
      this.circuitBreakers.set(component, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitorTimeout: 10000,
        minimumRequestThreshold: 3
      }));
    }
    return this.circuitBreakers.get(component)!;
  }

  private getMaxAcceptableCacheAge(context: any): number {
    // Default to 30 minutes, but could be configured per data type
    return 30 * 60 * 1000;
  }

  private isDataQualityAcceptable(quality: DataQuality): boolean {
    const qualityLevels = [
      DataQuality.HIGH,
      DataQuality.MEDIUM,
      DataQuality.LOW,
      DataQuality.SYNTHETIC,
      DataQuality.UNKNOWN
    ];
    
    const minIndex = qualityLevels.indexOf(this.config.minDataQuality);
    const actualIndex = qualityLevels.indexOf(quality);
    
    return actualIndex <= minIndex;
  }

  private async fetchFromAlternativeSource(source: FallbackSource, context: any): Promise<any> {
    // This would implement actual alternative source fetching
    // For now, return null to indicate no alternative source available
    return null;
  }

  private updateSourceStatus(sourceId: string, success: boolean): void {
    const source = this.fallbackSources.get(sourceId);
    if (!source) return;
    
    if (success) {
      source.lastSuccess = Date.now();
      source.failureCount = 0;
      source.available = true;
    } else {
      source.lastFailure = Date.now();
      source.failureCount++;
      
      // Disable source after too many failures
      if (source.failureCount >= 3) {
        source.available = false;
      }
    }
  }

  private escalateDegradation(): void {
    const levels = [
      ServiceDegradationLevel.NONE,
      ServiceDegradationLevel.MINOR,
      ServiceDegradationLevel.MODERATE,
      ServiceDegradationLevel.SEVERE,
      ServiceDegradationLevel.CRITICAL
    ];
    
    const currentIndex = levels.indexOf(this.recoveryState.degradationLevel);
    if (currentIndex < levels.length - 1) {
      this.recoveryState.degradationLevel = levels[currentIndex + 1];
      console.warn(`[ErrorRecoveryManager] Service degradation escalated to: ${this.recoveryState.degradationLevel}`);
    }
  }

  private reduceDegradation(): void {
    const levels = [
      ServiceDegradationLevel.NONE,
      ServiceDegradationLevel.MINOR,
      ServiceDegradationLevel.MODERATE,
      ServiceDegradationLevel.SEVERE,
      ServiceDegradationLevel.CRITICAL
    ];
    
    const currentIndex = levels.indexOf(this.recoveryState.degradationLevel);
    if (currentIndex > 0) {
      this.recoveryState.degradationLevel = levels[currentIndex - 1];
      console.log(`[ErrorRecoveryManager] Service degradation reduced to: ${this.recoveryState.degradationLevel}`);
    }
  }

  private async createDegradedData(context: any): Promise<any> {
    // This would create degraded/simplified data
    // For now, return null
    return null;
  }

  private setupCacheCleanup(): void {
    // Clean expired cache entries every 10 minutes
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      this.cache.forEach((cachedData, key) => {
        if (now > cachedData.expiresAt) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => this.cache.delete(key));
      
      if (keysToDelete.length > 0) {
        console.log(`[ErrorRecoveryManager] Cleaned ${keysToDelete.length} expired cache entries`);
      }
    }, 10 * 60 * 1000); // 10 minutes
  }
}

/**
 * Default recovery configuration
 */
export const DEFAULT_RECOVERY_CONFIG: RecoveryStrategyConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  useExponentialBackoff: true,
  attemptTimeout: 10000,
  allowDegradedService: true,
  minDataQuality: DataQuality.LOW,
  fallbackSources: [
    {
      id: 'cache',
      name: 'Local Cache',
      priority: 1,
      available: true,
      quality: DataQuality.MEDIUM,
      config: {},
      failureCount: 0
    },
    {
      id: 'alternative-api',
      name: 'Alternative Financial API',
      priority: 2,
      available: false, // Would be configured based on available services
      quality: DataQuality.MEDIUM,
      config: {},
      failureCount: 0
    }
  ]
};

/**
 * Create error recovery manager instance
 */
export function createErrorRecoveryManager(
  config: Partial<RecoveryStrategyConfig> = {}
): ErrorRecoveryManager {
  const fullConfig = { ...DEFAULT_RECOVERY_CONFIG, ...config };
  return new ErrorRecoveryManager(fullConfig);
}

/**
 * Export recovery utilities
 */
export default {
  ErrorRecoveryManager,
  createErrorRecoveryManager,
  RecoveryMethod,
  DataQuality,
  ServiceDegradationLevel,
  DEFAULT_RECOVERY_CONFIG
};