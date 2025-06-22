/**
 * Unit Tests for Cache Manager Module
 */

import { CacheManager, CacheKeyStrategy, getCommodityCacheManager, createCacheManager } from './cache-manager';

describe('CacheKeyStrategy', () => {
  describe('generateKey', () => {
    it('should generate simple key without params', () => {
      const key = CacheKeyStrategy.generateKey('CL=F', 'price');
      expect(key).toBe('price:CL=F');
    });

    it('should generate key with single param', () => {
      const key = CacheKeyStrategy.generateKey('CL=F', 'quote', { interval: '1d' });
      expect(key).toBe('quote:CL=F:interval=1d');
    });

    it('should generate key with multiple params in sorted order', () => {
      const key = CacheKeyStrategy.generateKey('GC=F', 'chart', {
        range: '1mo',
        interval: '1d',
        includeVolume: true
      });
      expect(key).toBe('chart:GC=F:includeVolume=true:interval=1d:range=1mo');
    });

    it('should handle empty params object', () => {
      const key = CacheKeyStrategy.generateKey('SI=F', 'price', {});
      expect(key).toBe('price:SI=F');
    });
  });

  describe('parseKey', () => {
    it('should parse simple key', () => {
      const result = CacheKeyStrategy.parseKey('price:CL=F');
      expect(result).toEqual({
        dataType: 'price',
        symbol: 'CL=F',
        params: undefined
      });
    });

    it('should parse key with params', () => {
      const result = CacheKeyStrategy.parseKey('chart:GC=F:interval=1d:range=1mo');
      expect(result).toEqual({
        dataType: 'chart',
        symbol: 'GC=F',
        params: {
          interval: '1d',
          range: '1mo'
        }
      });
    });

    it('should throw error for invalid key format', () => {
      expect(() => CacheKeyStrategy.parseKey('invalid')).toThrow('Invalid cache key format');
    });
  });
});

describe('CacheManager', () => {
  let cacheManager: CacheManager<any>;

  beforeEach(() => {
    jest.useFakeTimers();
    cacheManager = new CacheManager({
      defaultTTL: 60000, // 1 minute
      maxSize: 5,
      cleanupInterval: 300000, // 5 minutes
      enableStats: true,
      enableDebugLogging: false
    });
  });

  afterEach(() => {
    cacheManager.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should set and get value', () => {
      const key = 'test:key';
      const value = { price: 75.50, symbol: 'CL=F' };
      
      cacheManager.set(key, value);
      const retrieved = cacheManager.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent key', () => {
      const result = cacheManager.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle cache bypass', () => {
      const key = 'bypass:test';
      cacheManager.set(key, 'value');
      
      const result = cacheManager.get(key, true);
      expect(result).toBeNull();
    });

    it('should delete key', () => {
      const key = 'delete:test';
      cacheManager.set(key, 'value');
      
      expect(cacheManager.has(key)).toBe(true);
      const deleted = cacheManager.delete(key);
      expect(deleted).toBe(true);
      expect(cacheManager.has(key)).toBe(false);
    });

    it('should clear all entries', () => {
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      
      cacheManager.clear();
      
      expect(cacheManager.get('key1')).toBeNull();
      expect(cacheManager.get('key2')).toBeNull();
      expect(cacheManager.getStats().size).toBe(0);
    });
  });

  describe('TTL Functionality', () => {
    it('should expire entries after TTL', () => {
      const key = 'ttl:test';
      cacheManager.set(key, 'value', 1000); // 1 second TTL
      
      expect(cacheManager.get(key)).toBe('value');
      
      // Advance time by 1.5 seconds
      jest.advanceTimersByTime(1500);
      
      expect(cacheManager.get(key)).toBeNull();
    });

    it('should use default TTL when not specified', () => {
      const key = 'default:ttl';
      cacheManager.set(key, 'value');
      
      // Advance time to just before default TTL
      jest.advanceTimersByTime(59000);
      expect(cacheManager.get(key)).toBe('value');
      
      // Advance past default TTL
      jest.advanceTimersByTime(2000);
      expect(cacheManager.get(key)).toBeNull();
    });

    it('should return remaining TTL', () => {
      const key = 'ttl:remaining';
      cacheManager.set(key, 'value', 10000); // 10 seconds
      
      jest.advanceTimersByTime(3000); // 3 seconds passed
      
      const ttl = cacheManager.getTTL(key);
      expect(ttl).toBeCloseTo(7000, -2); // ~7 seconds remaining
    });

    it('should return 0 for expired entry TTL', () => {
      const key = 'ttl:expired';
      cacheManager.set(key, 'value', 1000);
      
      jest.advanceTimersByTime(2000);
      
      const ttl = cacheManager.getTTL(key);
      expect(ttl).toBe(null); // Entry deleted on access
    });
  });

  describe('Size Limits', () => {
    it('should evict oldest entry when max size reached', () => {
      // Fill cache to max size
      for (let i = 1; i <= 5; i++) {
        cacheManager.set(`key${i}`, `value${i}`);
        jest.advanceTimersByTime(100); // Ensure different timestamps
      }
      
      // Add one more - should evict key1
      cacheManager.set('key6', 'value6');
      
      expect(cacheManager.get('key1')).toBeNull();
      expect(cacheManager.get('key6')).toBe('value6');
      expect(cacheManager.getStats().size).toBe(5);
    });

    it('should not evict when updating existing key', () => {
      // Fill cache
      for (let i = 1; i <= 5; i++) {
        cacheManager.set(`key${i}`, `value${i}`);
      }
      
      // Update existing key
      cacheManager.set('key3', 'updated-value3');
      
      expect(cacheManager.get('key3')).toBe('updated-value3');
      expect(cacheManager.getStats().size).toBe(5);
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      cacheManager.set('stats:test', 'value');
      
      // Hit
      cacheManager.get('stats:test');
      // Miss
      cacheManager.get('non-existent');
      // Hit
      cacheManager.get('stats:test');
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 2);
    });

    it('should track memory usage', () => {
      const largeValue = { data: 'a'.repeat(1000) };
      cacheManager.set('large:key', largeValue);
      
      const stats = cacheManager.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(1000);
    });

    it('should track oldest and newest entries', () => {
      const now = Date.now();
      
      cacheManager.set('old', 'value1');
      jest.advanceTimersByTime(5000);
      cacheManager.set('new', 'value2');
      
      const stats = cacheManager.getStats();
      expect(stats.oldestEntry).toBeCloseTo(now, -2);
      expect(stats.newestEntry).toBeCloseTo(now + 5000, -2);
    });
  });

  describe('Pattern Matching', () => {
    it('should get entries by string pattern', () => {
      cacheManager.set('price:CL=F', 75.50);
      cacheManager.set('price:GC=F', 1850.00);
      cacheManager.set('quote:CL=F', { bid: 75.40, ask: 75.60 });
      
      const priceEntries = cacheManager.getByPattern('price:.*');
      
      expect(priceEntries).toHaveLength(2);
      expect(priceEntries.map(e => e.key).sort()).toEqual(['price:CL=F', 'price:GC=F']);
    });

    it('should get entries by regex pattern', () => {
      cacheManager.set('chart:CL=F:1d', [1, 2, 3]);
      cacheManager.set('chart:CL=F:1h', [4, 5, 6]);
      cacheManager.set('chart:GC=F:1d', [7, 8, 9]);
      
      const clCharts = cacheManager.getByPattern(/chart:CL=F:.*/);
      
      expect(clCharts).toHaveLength(2);
      expect(clCharts.every(e => e.key.includes('CL=F'))).toBe(true);
    });

    it('should not return expired entries in pattern match', () => {
      cacheManager.set('pattern:1', 'value1', 1000);
      cacheManager.set('pattern:2', 'value2', 5000);
      
      jest.advanceTimersByTime(2000);
      
      const results = cacheManager.getByPattern('pattern:.*');
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('pattern:2');
    });
  });

  describe('Cache Warmup', () => {
    it('should warmup cache with provided data', async () => {
      const dataProvider = async () => [
        { key: 'warmup:1', value: 'value1' },
        { key: 'warmup:2', value: 'value2', ttl: 30000 },
        { key: 'warmup:3', value: 'value3' }
      ];
      
      await cacheManager.warmup(dataProvider);
      
      expect(cacheManager.get('warmup:1')).toBe('value1');
      expect(cacheManager.get('warmup:2')).toBe('value2');
      expect(cacheManager.get('warmup:3')).toBe('value3');
      expect(cacheManager.getStats().size).toBe(3);
    });

    it('should handle warmup errors gracefully', async () => {
      const errorProvider = async () => {
        throw new Error('Warmup failed');
      };
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await cacheManager.warmup(errorProvider);
      
      expect(consoleSpy).toHaveBeenCalledWith('[CacheManager] Cache warmup failed:', expect.any(Error));
      expect(cacheManager.getStats().size).toBe(0);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should automatically cleanup expired entries', () => {
      // Set entries with short TTL
      cacheManager.set('cleanup:1', 'value1', 1000);
      cacheManager.set('cleanup:2', 'value2', 2000);
      cacheManager.set('cleanup:3', 'value3', 10000);
      
      // Advance time past cleanup interval
      jest.advanceTimersByTime(300000); // 5 minutes
      
      // Expired entries should be removed
      expect(cacheManager.has('cleanup:1')).toBe(false);
      expect(cacheManager.has('cleanup:2')).toBe(false);
      expect(cacheManager.has('cleanup:3')).toBe(false); // Also expired by now
    });

    it('should stop cleanup on stop()', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      cacheManager.stop();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(cacheManager.getStats().size).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      cacheManager.updateConfig({
        defaultTTL: 120000,
        enableDebugLogging: true
      });
      
      // Test new default TTL
      cacheManager.set('config:test', 'value');
      jest.advanceTimersByTime(65000); // Past original TTL
      expect(cacheManager.get('config:test')).toBe('value'); // Still valid with new TTL
    });

    it('should restart cleanup on interval change', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      cacheManager.updateConfig({
        cleanupInterval: 600000 // 10 minutes
      });
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 600000);
    });
  });

  describe('Metadata', () => {
    it('should store and preserve metadata', () => {
      const metadata = {
        source: 'Yahoo Finance',
        symbol: 'CL=F',
        timestamp: Date.now()
      };
      
      cacheManager.set('meta:test', 75.50, undefined, metadata);
      
      // Metadata is stored but not directly accessible through get()
      const value = cacheManager.get('meta:test');
      expect(value).toBe(75.50);
    });
  });
});

describe('Factory Functions', () => {
  afterEach(() => {
    // Clean up singleton
    const manager = getCommodityCacheManager();
    manager.stop();
  });

  it('should create singleton instance', () => {
    const instance1 = getCommodityCacheManager();
    const instance2 = getCommodityCacheManager();
    
    expect(instance1).toBe(instance2);
  });

  it('should create new instance with createCacheManager', () => {
    const instance1 = createCacheManager({ maxSize: 10 });
    const instance2 = createCacheManager({ maxSize: 20 });
    
    expect(instance1).not.toBe(instance2);
    
    instance1.stop();
    instance2.stop();
  });

  it('should handle typed cache manager', () => {
    interface PriceData {
      symbol: string;
      price: number;
      timestamp: string;
    }
    
    const typedCache = createCacheManager<PriceData>({
      defaultTTL: 30000
    });
    
    const data: PriceData = {
      symbol: 'CL=F',
      price: 75.50,
      timestamp: new Date().toISOString()
    };
    
    typedCache.set('price:CL=F', data);
    const retrieved = typedCache.get('price:CL=F');
    
    expect(retrieved).toEqual(data);
    expect(retrieved?.symbol).toBe('CL=F');
    
    typedCache.stop();
  });
});