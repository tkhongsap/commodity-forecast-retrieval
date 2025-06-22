/**
 * Cache Manager Module
 * 
 * In-memory cache implementation with TTL (Time To Live) support for commodity data.
 * Provides efficient caching for API responses with automatic expiration, statistics tracking,
 * and extensible design to support multiple commodity symbols.
 * 
 * Features:
 * - Generic cache storage with TTL support
 * - Automatic cache cleanup for expired entries
 * - Cache hit/miss statistics tracking
 * - Cache bypass options for real-time requirements
 * - Cache warmup functionality
 * - Thread-safe operations
 * 
 * @author Cache Manager Module
 * @version 1.0.0
 */

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Timestamp when the entry was created */
  timestamp: number;
  /** Time to live in milliseconds */
  ttl: number;
  /** Number of times this entry has been accessed */
  hits: number;
  /** Optional metadata */
  metadata?: {
    source?: string;
    symbol?: string;
    [key: string]: any;
  };
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Current number of entries in cache */
  size: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Total memory usage (approximate) */
  memoryUsage: number;
  /** List of cached keys */
  keys: string[];
  /** Oldest entry timestamp */
  oldestEntry?: number;
  /** Newest entry timestamp */
  newestEntry?: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** Maximum cache size (number of entries) */
  maxSize: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Enable statistics tracking */
  enableStats: boolean;
  /** Enable debug logging */
  enableDebugLogging: boolean;
}

/**
 * Cache key strategy for commodity symbols
 */
export class CacheKeyStrategy {
  /**
   * Generate cache key for commodity price data
   * @param symbol - Commodity symbol (e.g., 'CL=F')
   * @param dataType - Type of data (e.g., 'price', 'quote', 'chart')
   * @param params - Optional parameters for key generation
   */
  static generateKey(symbol: string, dataType: string, params?: Record<string, any>): string {
    const baseKey = `${dataType}:${symbol}`;
    
    if (!params || Object.keys(params).length === 0) {
      return baseKey;
    }
    
    // Sort params for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join(':');
    
    return `${baseKey}:${sortedParams}`;
  }
  
  /**
   * Parse cache key to extract components
   */
  static parseKey(key: string): { dataType: string; symbol: string; params?: Record<string, string> } {
    const parts = key.split(':');
    
    if (parts.length < 2) {
      throw new Error(`Invalid cache key format: ${key}`);
    }
    
    const [dataType, symbol, ...paramParts] = parts;
    
    const params: Record<string, string> = {};
    paramParts.forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        params[key] = value;
      }
    });
    
    return {
      dataType: dataType || '',
      symbol: symbol || '',
      params: Object.keys(params).length > 0 ? params : undefined
    };
  }
}

/**
 * Cache Manager implementation
 */
export class CacheManager<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
  };
  private cleanupTimer?: NodeJS.Timer;
  private logger: Console;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      cleanupInterval: 10 * 60 * 1000, // 10 minutes
      enableStats: true,
      enableDebugLogging: false,
      ...config
    };
    
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
    this.logger = console;
    
    this.setupCleanup();
  }

  /**
   * Get value from cache
   */
  get(key: string, bypassCache: boolean = false): T | null {
    if (bypassCache) {
      if (this.config.enableDebugLogging) {
        this.logger.log(`[CacheManager] Bypassing cache for key: ${key}`);
      }
      return null;
    }
    
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.recordMiss();
      return null;
    }
    
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      // Entry has expired
      this.cache.delete(key);
      this.recordMiss();
      if (this.config.enableDebugLogging) {
        this.logger.log(`[CacheManager] Cache expired for key: ${key}`);
      }
      return null;
    }
    
    // Update hit count
    entry.hits++;
    this.recordHit();
    
    if (this.config.enableDebugLogging) {
      this.logger.log(`[CacheManager] Cache hit for key: ${key}`);
    }
    
    return entry.data;
  }

  /**
   * Set value in cache with optional custom TTL
   */
  set(key: string, value: T, ttl?: number, metadata?: Record<string, any>): void {
    // Check max size limit
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      // Remove oldest entry
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        if (this.config.enableDebugLogging) {
          this.logger.log(`[CacheManager] Evicted oldest entry: ${oldestKey}`);
        }
      }
    }
    
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      hits: 0,
      metadata
    };
    
    this.cache.set(key, entry);
    
    if (this.config.enableDebugLogging) {
      this.logger.log(`[CacheManager] Cached key: ${key} with TTL: ${entry.ttl}ms`);
    }
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result && this.config.enableDebugLogging) {
      this.logger.log(`[CacheManager] Deleted key: ${key}`);
    }
    return result;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    
    if (this.config.enableDebugLogging) {
      this.logger.log(`[CacheManager] Cleared ${size} cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const keys = Array.from(this.cache.keys());
    const entries = Array.from(this.cache.values());
    
    let oldestTimestamp: number | undefined;
    let newestTimestamp: number | undefined;
    let totalMemory = 0;
    
    entries.forEach(entry => {
      if (!oldestTimestamp || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (!newestTimestamp || entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
      
      // Approximate memory usage
      totalMemory += JSON.stringify(entry).length;
    });
    
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: totalMemory,
      keys,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp
    };
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get remaining TTL for a key
   */
  getTTL(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    const remaining = (entry.timestamp + entry.ttl) - now;
    
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Warmup cache with predefined data
   */
  async warmup(dataProvider: () => Promise<Array<{ key: string; value: T; ttl?: number }>>): Promise<void> {
    try {
      if (this.config.enableDebugLogging) {
        this.logger.log('[CacheManager] Starting cache warmup...');
      }
      
      const entries = await dataProvider();
      
      entries.forEach(({ key, value, ttl }) => {
        this.set(key, value, ttl);
      });
      
      if (this.config.enableDebugLogging) {
        this.logger.log(`[CacheManager] Cache warmup completed. Loaded ${entries.length} entries`);
      }
    } catch (error) {
      this.logger.error('[CacheManager] Cache warmup failed:', error);
    }
  }

  /**
   * Get all entries matching a pattern
   */
  getByPattern(pattern: string | RegExp): Array<{ key: string; value: T }> {
    const results: Array<{ key: string; value: T }> = [];
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    this.cache.forEach((entry, key) => {
      if (regex.test(key)) {
        const now = Date.now();
        if (now <= entry.timestamp + entry.ttl) {
          results.push({ key, value: entry.data });
        }
      }
    });
    
    return results;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart cleanup if interval changed
    if (config.cleanupInterval) {
      this.setupCleanup();
    }
  }

  /**
   * Stop cache manager and cleanup
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  // Private methods

  private recordHit(): void {
    if (this.config.enableStats) {
      this.stats.hits++;
    }
  }

  private recordMiss(): void {
    if (this.config.enableStats) {
      this.stats.misses++;
    }
  }

  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    
    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    });
    
    return oldestKey;
  }

  private setupCleanup(): void {
    // Clear existing timer if any
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Setup new cleanup interval
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      this.cache.forEach((entry, key) => {
        if (now > entry.timestamp + entry.ttl) {
          keysToDelete.push(key);
        }
      });
      
      if (keysToDelete.length > 0) {
        keysToDelete.forEach(key => this.cache.delete(key));
        
        if (this.config.enableDebugLogging) {
          this.logger.log(`[CacheManager] Cleanup removed ${keysToDelete.length} expired entries`);
        }
      }
    }, this.config.cleanupInterval);
  }
}

/**
 * Singleton cache manager instance for commodity data
 */
let commodityCacheInstance: CacheManager | null = null;

/**
 * Get singleton cache manager instance
 */
export function getCommodityCacheManager(config?: Partial<CacheConfig>): CacheManager {
  if (!commodityCacheInstance) {
    commodityCacheInstance = new CacheManager({
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 500,
      cleanupInterval: 10 * 60 * 1000, // 10 minutes
      enableStats: true,
      enableDebugLogging: false,
      ...config
    });
  }
  return commodityCacheInstance;
}

/**
 * Create new cache manager instance
 */
export function createCacheManager<T = any>(config?: Partial<CacheConfig>): CacheManager<T> {
  return new CacheManager<T>(config);
}

// Export default
export default CacheManager;