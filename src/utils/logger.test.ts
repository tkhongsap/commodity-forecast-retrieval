/**
 * Unit Tests for Enhanced Logger Module
 */

import {
  EnhancedLogger,
  LogLevel,
  DataSource,
  OperationType,
  LogEntry,
  LoggerConfig,
  getLogger,
  createLogger,
  Logger
} from './logger';

describe('EnhancedLogger', () => {
  let logger: EnhancedLogger;
  let consoleSpies: {
    debug: jest.SpyInstance;
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
    log: jest.SpyInstance;
  };

  beforeEach(() => {
    // Mock console methods
    consoleSpies = {
      debug: jest.spyOn(console, 'debug').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation()
    };

    logger = new EnhancedLogger({
      level: LogLevel.DEBUG,
      component: 'TestComponent',
      enableConsole: true,
      jsonFormat: false
    });
  });

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpies).forEach(spy => spy.mockRestore());
  });

  describe('Basic Logging', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message', { test: true });
      
      expect(consoleSpies.debug).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[0].message).toBe('Debug message');
      expect(logs[0].metadata).toEqual({ test: true });
    });

    it('should log info messages', () => {
      logger.info('Info message', { data: 'test' });
      
      expect(consoleSpies.info).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
      expect(logs[0].message).toBe('Info message');
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      
      expect(consoleSpies.warn).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[0].message).toBe('Warning message');
    });

    it('should log error messages with error objects', () => {
      const testError = new Error('Test error');
      logger.error('Error message', testError);
      
      expect(consoleSpies.error).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].message).toBe('Error message');
      expect(logs[0].error?.message).toBe('Test error');
    });

    it('should log fatal messages', () => {
      const fatalError = new Error('Fatal error');
      logger.fatal('Fatal message', fatalError);
      
      expect(consoleSpies.error).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].level).toBe(LogLevel.FATAL);
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect minimum log level', () => {
      const warnLogger = new EnhancedLogger({
        level: LogLevel.WARN,
        enableConsole: true
      });

      warnLogger.debug('Debug message');
      warnLogger.info('Info message');
      warnLogger.warn('Warning message');
      
      const logs = warnLogger.getRecentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.WARN);
    });

    it('should filter logs by level when retrieving', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      
      const errorLogs = logger.getRecentLogs(10, LogLevel.ERROR);
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe(LogLevel.ERROR);
      
      const warnAndAbove = logger.getRecentLogs(10, LogLevel.WARN);
      expect(warnAndAbove).toHaveLength(2);
    });
  });

  describe('Data Source Logging', () => {
    it('should log data retrieval success', () => {
      logger.logDataRetrieval(
        'CL=F',
        DataSource.YAHOO_FINANCE,
        true,
        250,
        75.50,
        undefined,
        { source: 'test' }
      );
      
      expect(consoleSpies.info).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].operation).toBe(OperationType.PRICE_FETCH);
      expect(logs[0].dataSource).toBe(DataSource.YAHOO_FINANCE);
      expect(logs[0].duration).toBe(250);
      expect(logs[0].metadata?.symbol).toBe('CL=F');
      expect(logs[0].metadata?.price).toBe(75.50);
      expect(logs[0].success).toBe(true);
    });

    it('should log data retrieval failure', () => {
      const error = new Error('API failed');
      logger.logDataRetrieval(
        'CL=F',
        DataSource.YAHOO_FINANCE,
        false,
        1000,
        undefined,
        error
      );
      
      expect(consoleSpies.error).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].success).toBe(false);
      expect(logs[0].error?.message).toBe('API failed');
    });
  });

  describe('Cache Operation Logging', () => {
    it('should log cache hits', () => {
      logger.logCacheOperation('hit', 'price:CL=F', true, { ttl: 300000 });
      
      const logs = logger.getRecentLogs(1);
      expect(logs[0].operation).toBe(OperationType.CACHE_OPERATION);
      expect(logs[0].dataSource).toBe(DataSource.CACHE);
      expect(logs[0].metadata?.cacheKey).toBe('price:CL=F');
      expect(logs[0].metadata?.cacheOperation).toBe('hit');
    });

    it('should log cache misses', () => {
      logger.logCacheOperation('miss', 'quote:GC=F');
      
      const logs = logger.getRecentLogs(1);
      expect(logs[0].metadata?.cacheOperation).toBe('miss');
    });

    it('should log cache set operations', () => {
      logger.logCacheOperation('set', 'chart:CL=F:1d', true, { size: 1024 });
      
      const logs = logger.getRecentLogs(1);
      expect(logs[0].metadata?.cacheOperation).toBe('set');
      expect(logs[0].metadata?.size).toBe(1024);
    });
  });

  describe('Performance Metrics Logging', () => {
    it('should log performance metrics', () => {
      logger.logPerformanceMetrics(
        OperationType.QUOTE_FETCH,
        DataSource.YAHOO_FINANCE,
        150,
        true,
        { symbol: 'CL=F' }
      );
      
      const logs = logger.getRecentLogs(1);
      expect(logs[0].metrics?.responseTime).toBe(150);
      expect(logs[0].metrics?.success).toBe(1);
      expect(logs[0].duration).toBe(150);
    });

    it('should log failed operations', () => {
      logger.logPerformanceMetrics(
        OperationType.CHART_FETCH,
        DataSource.YAHOO_FINANCE,
        5000,
        false
      );
      
      const logs = logger.getRecentLogs(1);
      expect(logs[0].metrics?.success).toBe(0);
    });
  });

  describe('Fallback Logging', () => {
    it('should log fallback activation', () => {
      logger.logFallback(
        DataSource.YAHOO_FINANCE,
        DataSource.OPENAI_FALLBACK,
        'API rate limit exceeded',
        { retryCount: 3 }
      );
      
      expect(consoleSpies.warn).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].operation).toBe(OperationType.FALLBACK);
      expect(logs[0].metadata?.primarySource).toBe(DataSource.YAHOO_FINANCE);
      expect(logs[0].metadata?.fallbackSource).toBe(DataSource.OPENAI_FALLBACK);
      expect(logs[0].metadata?.fallbackReason).toBe('API rate limit exceeded');
    });
  });

  describe('Validation Logging', () => {
    it('should log successful validation', () => {
      logger.logValidation(
        'CL=F',
        true,
        0.95,
        [],
        ['Price in warning range'],
        { source: 'Yahoo Finance' }
      );
      
      expect(consoleSpies.info).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].operation).toBe(OperationType.VALIDATION);
      expect(logs[0].metadata?.validationResult).toBe(true);
      expect(logs[0].metadata?.confidence).toBe(0.95);
      expect(logs[0].metadata?.warnings).toEqual(['Price in warning range']);
    });

    it('should log failed validation', () => {
      logger.logValidation(
        'CL=F',
        false,
        0.3,
        ['Price out of range'],
        []
      );
      
      expect(consoleSpies.warn).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].metadata?.validationResult).toBe(false);
      expect(logs[0].metadata?.errors).toEqual(['Price out of range']);
    });
  });

  describe('Audit Trail Logging', () => {
    it('should log audit trail entries', () => {
      logger.logAuditTrail(
        'FETCH_PRICE',
        'system',
        'CL=F',
        true,
        { requestId: '123' }
      );
      
      expect(consoleSpies.info).toHaveBeenCalled();
      const logs = logger.getRecentLogs(1);
      expect(logs[0].metadata?.auditAction).toBe('FETCH_PRICE');
      expect(logs[0].metadata?.auditUser).toBe('system');
      expect(logs[0].metadata?.auditResource).toBe('CL=F');
      expect(logs[0].metadata?.auditResult).toBe(true);
    });
  });

  describe('Performance Metrics Aggregation', () => {
    beforeEach(() => {
      // Clear existing logs
      logger.clearLogs();
    });

    it('should calculate performance metrics correctly', () => {
      // Add some test log entries
      logger.logDataRetrieval('CL=F', DataSource.YAHOO_FINANCE, true, 100, 75.50);
      logger.logDataRetrieval('GC=F', DataSource.YAHOO_FINANCE, true, 150, 1900);
      logger.logDataRetrieval('SI=F', DataSource.YAHOO_FINANCE, false, 5000, undefined, new Error('Timeout'));
      logger.logCacheOperation('hit', 'price:CL=F', true);
      logger.logCacheOperation('miss', 'price:NG=F', true);
      
      const metrics = logger.getPerformanceMetrics(60);
      
      expect(metrics.totalOperations).toBe(5);
      expect(metrics.successfulOperations).toBe(4);
      expect(metrics.failedOperations).toBe(1);
      expect(metrics.successRate).toBe(80);
      expect(metrics.averageResponseTime).toBeCloseTo(1750, 0); // (100+150+5000)/3
      expect(metrics.byDataSource[DataSource.YAHOO_FINANCE]).toBe(3);
      expect(metrics.byDataSource[DataSource.CACHE]).toBe(2);
      expect(metrics.cacheHitRate).toBe(50); // 1 hit, 1 miss
    });

    it('should handle empty metrics gracefully', () => {
      const metrics = logger.getPerformanceMetrics(60);
      
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
    });

    it('should filter metrics by time range', () => {
      logger.logDataRetrieval('CL=F', DataSource.YAHOO_FINANCE, true, 100, 75.50);
      
      // Very short time range should exclude the log
      const recentMetrics = logger.getPerformanceMetrics(0.001); // 0.001 minutes
      expect(recentMetrics.totalOperations).toBe(0);
      
      // Longer time range should include it
      const allMetrics = logger.getPerformanceMetrics(60);
      expect(allMetrics.totalOperations).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customLogger = new EnhancedLogger({
        level: LogLevel.ERROR,
        component: 'CustomComponent',
        jsonFormat: true,
        includeStackTrace: false
      });

      customLogger.info('This should not appear');
      customLogger.error('This should appear', new Error('Test'));
      
      const logs = customLogger.getRecentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].component).toBe('CustomComponent');
      expect(logs[0].error?.stack).toBeUndefined();
    });

    it('should update configuration', () => {
      logger.updateConfig({
        level: LogLevel.ERROR,
        jsonFormat: true
      });
      
      logger.info('Should be filtered');
      logger.error('Should appear');
      
      const logs = logger.getRecentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
    });
  });

  describe('JSON Format Output', () => {
    it('should output JSON format when configured', () => {
      const jsonLogger = new EnhancedLogger({
        jsonFormat: true,
        enableConsole: true
      });

      jsonLogger.info('Test message', { test: true });
      
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\{.*\}$/) // JSON string
      );
    });

    it('should output plain format when configured', () => {
      const plainLogger = new EnhancedLogger({
        jsonFormat: false,
        includeTimestamp: true,
        enableConsole: true
      });

      plainLogger.info('Test message');
      
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[.*\] \[INFO\] Test message$/)
      );
    });
  });

  describe('Log Export', () => {
    it('should export logs as JSON', () => {
      logger.info('Test log entry');
      
      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);
      
      expect(parsed.config).toBeDefined();
      expect(parsed.startTime).toBeDefined();
      expect(parsed.exportTime).toBeDefined();
      expect(parsed.totalEntries).toBe(1);
      expect(parsed.logs).toHaveLength(1);
      expect(parsed.logs[0].message).toBe('Test log entry');
    });
  });

  describe('Memory Management', () => {
    it('should respect max metrics entries limit', () => {
      const limitedLogger = new EnhancedLogger({
        enableMetrics: true,
        maxMetricsEntries: 5
      });

      // Add more entries than the limit
      for (let i = 0; i < 10; i++) {
        limitedLogger.info(`Message ${i}`);
      }
      
      const metrics = limitedLogger.getPerformanceMetrics(60);
      expect(metrics.totalOperations).toBeLessThanOrEqual(5);
    });

    it('should clear logs and metrics', () => {
      logger.info('Test 1');
      logger.info('Test 2');
      
      expect(logger.getRecentLogs()).toHaveLength(2);
      
      logger.clearLogs();
      
      expect(logger.getRecentLogs()).toHaveLength(0);
      const metrics = logger.getPerformanceMetrics(60);
      expect(metrics.totalOperations).toBe(0);
    });
  });
});

describe('Factory Functions', () => {
  let consoleSpies: any;

  beforeEach(() => {
    consoleSpies = {
      debug: jest.spyOn(console, 'debug').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach((spy: any) => spy.mockRestore());
  });

  it('should create singleton instance', () => {
    const instance1 = getLogger();
    const instance2 = getLogger();
    
    expect(instance1).toBe(instance2);
  });

  it('should create new instances', () => {
    const instance1 = createLogger();
    const instance2 = createLogger();
    
    expect(instance1).not.toBe(instance2);
  });
});

describe('Convenience Logger', () => {
  let consoleSpies: any;

  beforeEach(() => {
    consoleSpies = {
      debug: jest.spyOn(console, 'debug').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach((spy: any) => spy.mockRestore());
  });

  it('should use convenience methods', () => {
    Logger.info('Test info');
    Logger.warn('Test warning');
    Logger.error('Test error', new Error('Test'));
    
    expect(consoleSpies.info).toHaveBeenCalled();
    expect(consoleSpies.warn).toHaveBeenCalled();
    expect(consoleSpies.error).toHaveBeenCalled();
  });

  it('should use specialized logging methods', () => {
    Logger.logDataRetrieval('CL=F', DataSource.YAHOO_FINANCE, true, 100, 75.50);
    Logger.logCacheOperation('hit', 'test:key');
    Logger.logFallback(DataSource.YAHOO_FINANCE, DataSource.OPENAI_FALLBACK, 'API down');
    Logger.logValidation('CL=F', true, 0.9);
    
    expect(consoleSpies.info).toHaveBeenCalled();
    expect(consoleSpies.warn).toHaveBeenCalled();
  });

  it('should provide metrics through convenience method', () => {
    Logger.logDataRetrieval('CL=F', DataSource.YAHOO_FINANCE, true, 100, 75.50);
    
    const metrics = Logger.getMetrics();
    expect(metrics.totalOperations).toBeGreaterThan(0);
  });
});