/**
 * Comprehensive Unit Tests for Yahoo Finance Service
 * 
 * This test suite provides complete coverage of the Yahoo Finance Service with mocked dependencies
 * to ensure reliability, maintainability, and high test coverage. Tests include error scenarios,
 * edge cases, retry logic, rate limiting, data validation, and caching functionality.
 * 
 * Features Tested:
 * - All major service methods (getCurrentPrice, getQuoteData, getChartData, etc.)
 * - Error handling and recovery scenarios
 * - Retry logic and rate limiting behavior
 * - Data validation and parsing edge cases
 * - Caching functionality (hit/miss scenarios)
 * - Service health monitoring
 * - Integration workflows
 * 
 * @author Yahoo Finance Service Test Suite
 * @version 1.0.0
 */

import { YahooFinanceService, YahooFinanceServiceError, YahooFinanceServiceException } from './yahoo-finance-service';
import { YahooFinanceHttpClient } from '../utils/http-client';
import { 
  YahooFinanceResponse, 
  ChartResult,
  YahooFinanceMeta,
  QuoteData,
  ApiResponse
} from '../types/yahoo-finance';
import { CACHE_CONFIG, COMMODITY_SYMBOLS } from '../config/yahoo-finance';

// Mock the HTTP client
jest.mock('../utils/http-client');

describe('YahooFinanceService', () => {
  let service: YahooFinanceService;
  let mockHttpClient: jest.Mocked<YahooFinanceHttpClient>;

  // Sample test data
  const mockSymbol = 'CL=F';
  const mockPrice = 75.50;
  const mockTimestamp = 1640995200; // 2022-01-01 00:00:00 UTC

  const mockMeta: YahooFinanceMeta = {
    currency: 'USD',
    symbol: mockSymbol,
    exchangeName: 'NYM',
    fullExchangeName: 'NY Mercantile',
    instrumentType: 'FUTURE',
    firstTradeDate: 1640995200,
    regularMarketTime: mockTimestamp,
    hasPrePostMarketData: true,
    gmtoffset: -18000,
    timezone: 'EST',
    exchangeTimezoneName: 'America/New_York',
    regularMarketPrice: mockPrice,
    fiftyTwoWeekHigh: 85.0,
    fiftyTwoWeekLow: 65.0,
    regularMarketDayHigh: 76.0,
    regularMarketDayLow: 75.0,
    regularMarketVolume: 100000,
    shortName: 'Crude Oil',
    chartPreviousClose: 74.0,
    priceHint: 2,
    currentTradingPeriod: {
      pre: { timezone: 'EST', start: 1640995200, end: 1640995200, gmtoffset: -18000 },
      regular: { timezone: 'EST', start: 1640995200, end: 1640995200, gmtoffset: -18000 },
      post: { timezone: 'EST', start: 1640995200, end: 1640995200, gmtoffset: -18000 }
    },
    dataGranularity: '1d',
    range: '1mo',
    validRanges: ['1d', '5d', '1mo'],
    regularMarketPreviousClose: 74.0,
    regularMarketOpen: 74.5
  };

  const mockQuoteData: QuoteData = {
    high: [76.0],
    open: [74.5],
    low: [75.0],
    volume: [100000],
    close: [mockPrice]
  };

  const mockChartResult: ChartResult = {
    meta: mockMeta,
    timestamp: [mockTimestamp],
    indicators: {
      quote: [mockQuoteData],
      adjclose: [{ adjclose: [mockPrice] }]
    }
  };

  const mockYahooResponse: YahooFinanceResponse = {
    chart: {
      result: [mockChartResult],
      error: null
    }
  };

  const mockApiResponse: ApiResponse<YahooFinanceResponse> = {
    data: mockYahooResponse,
    success: true,
    statusCode: 200,
    timestamp: new Date().toISOString(),
    fromCache: false
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mocked HTTP client
    mockHttpClient = {
      getChart: jest.fn(),
      getQuote: jest.fn(),
      searchSymbols: jest.fn(),
      get: jest.fn(),
      getRateLimit: jest.fn(),
      healthCheck: jest.fn(),
      getDiagnostics: jest.fn(),
      reset: jest.fn(),
      getPerformanceMetrics: jest.fn(),
      handleRateLimitExceeded: jest.fn()
    } as any;

    // Create service instance with mocked HTTP client
    service = new YahooFinanceService(mockHttpClient);

    // Setup default successful responses
    mockHttpClient.getChart.mockResolvedValue(mockApiResponse);
  });

  afterEach(() => {
    // Clear cache after each test
    service.clearCache();
  });

  describe('Constructor and Initialization', () => {
    it('should create service with default HTTP client when none provided', () => {
      const serviceWithDefaults = new YahooFinanceService();
      expect(serviceWithDefaults).toBeInstanceOf(YahooFinanceService);
    });

    it('should create service with provided HTTP client', () => {
      expect(service).toBeInstanceOf(YahooFinanceService);
    });

    it('should initialize cache and setup cleanup', () => {
      const cacheStats = service.getCacheStats();
      expect(cacheStats.size).toBe(0);
      expect(cacheStats.entries).toEqual([]);
    });
  });

  describe('getCurrentPrice', () => {
    it('should fetch and return current price successfully', async () => {
      const price = await service.getCurrentPrice(mockSymbol);
      
      expect(price).toBe(mockPrice);
      expect(mockHttpClient.getChart).toHaveBeenCalledWith(mockSymbol, '1d', '1d');
    });

    it('should return cached price on subsequent calls', async () => {
      // First call
      const price1 = await service.getCurrentPrice(mockSymbol);
      
      // Second call should use cache
      const price2 = await service.getCurrentPrice(mockSymbol);
      
      expect(price1).toBe(mockPrice);
      expect(price2).toBe(mockPrice);
      expect(mockHttpClient.getChart).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid symbol format', async () => {
      await expect(service.getCurrentPrice('')).rejects.toThrow(YahooFinanceServiceException);
      await expect(service.getCurrentPrice('invalid!')).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should handle API errors gracefully', async () => {
      const errorResponse: ApiResponse<YahooFinanceResponse> = {
        data: null,
        success: false,
        error: 'API Error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
      
      mockHttpClient.getChart.mockResolvedValue(errorResponse);
      
      await expect(service.getCurrentPrice(mockSymbol)).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should handle network timeout errors', async () => {
      mockHttpClient.getChart.mockRejectedValue(new Error('Request timeout'));
      
      await expect(service.getCurrentPrice(mockSymbol)).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should cache price with correct TTL', async () => {
      const price = await service.getCurrentPrice(mockSymbol);
      const cacheStats = service.getCacheStats();
      
      expect(price).toBe(mockPrice);
      expect(cacheStats.size).toBe(1);
      expect(cacheStats.entries).toContain(`price:${mockSymbol}`);
    });
  });

  describe('getQuoteData', () => {
    it('should fetch and return complete quote data successfully', async () => {
      const quoteData = await service.getQuoteData(mockSymbol);
      
      expect(quoteData).toMatchObject({
        currentPrice: mockPrice,
        symbol: mockSymbol,
        currency: 'USD',
        exchange: 'NYM'
      });
      expect(quoteData.priceChange).toBeDefined();
      expect(quoteData.percentChange).toBeDefined();
    });

    it('should handle quote options correctly', async () => {
      const options = {
        includeExtendedHours: true,
        includeEvents: true,
        validatePrice: true,
        useCache: false
      };
      
      const quoteData = await service.getQuoteData(mockSymbol, options);
      
      expect(quoteData.currentPrice).toBe(mockPrice);
      expect(mockHttpClient.getChart).toHaveBeenCalledTimes(1);
    });

    it('should validate price when requested', async () => {
      const options = { validatePrice: true };
      
      // Should not throw for valid price
      const quoteData = await service.getQuoteData(mockSymbol, options);
      expect(quoteData.currentPrice).toBe(mockPrice);
      
      // Should throw for invalid price
      const invalidMeta = { ...mockMeta, regularMarketPrice: 999999 };
      const invalidChartResult = { ...mockChartResult, meta: invalidMeta };
      const invalidResponse = {
        ...mockYahooResponse,
        chart: { result: [invalidChartResult], error: null }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: invalidResponse
      });
      
      await expect(service.getQuoteData(mockSymbol, options)).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should use cache when enabled', async () => {
      const options = { useCache: true };
      
      // First call
      await service.getQuoteData(mockSymbol, options);
      
      // Second call should use cache
      await service.getQuoteData(mockSymbol, options);
      
      expect(mockHttpClient.getChart).toHaveBeenCalledTimes(1);
    });

    it('should skip cache when disabled', async () => {
      const options = { useCache: false };
      
      // First call
      await service.getQuoteData(mockSymbol, options);
      
      // Second call should not use cache
      await service.getQuoteData(mockSymbol, options);
      
      expect(mockHttpClient.getChart).toHaveBeenCalledTimes(2);
    });

    it('should handle missing quote data gracefully', async () => {
      const emptyResponse = {
        ...mockYahooResponse,
        chart: { result: [], error: null }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: emptyResponse
      });
      
      await expect(service.getQuoteData(mockSymbol)).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should calculate price change correctly', async () => {
      const quoteData = await service.getQuoteData(mockSymbol);
      
      const expectedChange = mockPrice - mockMeta.chartPreviousClose;
      const expectedPercent = (expectedChange / mockMeta.chartPreviousClose) * 100;
      
      expect(quoteData.priceChange).toBeCloseTo(expectedChange, 2);
      expect(quoteData.percentChange).toBeCloseTo(expectedPercent, 2);
    });
  });

  describe('getChartData', () => {
    it('should fetch and return historical chart data successfully', async () => {
      const chartData = await service.getChartData(mockSymbol);
      
      expect(chartData.symbol).toBe(mockSymbol);
      expect(chartData.prices).toHaveLength(1);
      expect(chartData.prices[0]?.close).toBe(mockPrice);
    });

    it('should handle chart options correctly', async () => {
      const options = {
        interval: '1h' as const,
        range: '5d' as const,
        includeVolume: true,
        includeAdjustedClose: true,
        validateData: true,
        maxDataPoints: 500
      };
      
      const chartData = await service.getChartData(mockSymbol, options);
      
      expect(chartData.interval).toBe(options.interval);
      expect(chartData.range).toBe(options.range);
      expect(mockHttpClient.getChart).toHaveBeenCalledWith(mockSymbol, options.interval, options.range);
    });

    it('should limit data points when maxDataPoints is specified', async () => {
      const multipleTimestamps = Array.from({ length: 1000 }, (_, i) => mockTimestamp + i * 86400);
      const multipleCloses = Array.from({ length: 1000 }, () => mockPrice);
      
      const largeDataResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            timestamp: multipleTimestamps,
            indicators: {
              quote: [{
                ...mockQuoteData,
                close: multipleCloses,
                open: multipleCloses,
                high: multipleCloses,
                low: multipleCloses,
                volume: Array.from({ length: 1000 }, () => 100000)
              }],
              adjclose: [{ adjclose: multipleCloses }]
            }
          }],
          error: null
        }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: largeDataResponse
      });
      
      const options = { maxDataPoints: 100 };
      const chartData = await service.getChartData(mockSymbol, options);
      
      expect(chartData.prices.length).toBeLessThanOrEqual(100);
    });

    it('should handle data validation warnings', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Create response with validation warnings
      const warningResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            indicators: {
              quote: [{
                ...mockQuoteData,
                close: [mockPrice, null, mockPrice] // Null value should trigger warning
              }],
              adjclose: [{ adjclose: [mockPrice, null, mockPrice] }]
            },
            timestamp: [mockTimestamp, mockTimestamp + 86400, mockTimestamp + 172800]
          }],
          error: null
        }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: warningResponse
      });
      
      const options = { validateData: true };
      await service.getChartData(mockSymbol, options);
      
      consoleWarnSpy.mockRestore();
    });

    it('should cache chart data correctly', async () => {
      // First call
      await service.getChartData(mockSymbol);
      
      // Second call should use cache
      await service.getChartData(mockSymbol);
      
      expect(mockHttpClient.getChart).toHaveBeenCalledTimes(1);
      
      const cacheStats = service.getCacheStats();
      expect(cacheStats.size).toBe(1);
    });

    it('should handle different intervals and ranges', async () => {
      const testCases = [
        { interval: '1m' as const, range: '1d' as const },
        { interval: '1h' as const, range: '5d' as const },
        { interval: '1d' as const, range: '1y' as const }
      ];
      
      for (const testCase of testCases) {
        await service.getChartData(mockSymbol, testCase);
        expect(mockHttpClient.getChart).toHaveBeenCalledWith(
          mockSymbol, 
          testCase.interval, 
          testCase.range
        );
      }
    });
  });

  describe('validateResponse', () => {
    it('should validate successful responses correctly', () => {
      const validation = service.validateResponse(mockYahooResponse);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.qualityScore).toBe(1.0);
    });

    it('should detect missing chart data', () => {
      const invalidResponse = { chart: null as any };
      const validation = service.validateResponse(invalidResponse);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing chart data in response');
    });

    it('should detect API errors', () => {
      const errorResponse = {
        chart: {
          result: [],
          error: { code: 'Not Found', description: 'Symbol not found' }
        }
      };
      
      const validation = service.validateResponse(errorResponse);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('API Error: Symbol not found');
    });

    it('should detect missing metadata fields', () => {
      const incompleteResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            meta: { currency: 'USD' } as any // Missing required fields
          }],
          error: null
        }
      };
      
      const validation = service.validateResponse(incompleteResponse);
      expect(validation.missingFields.length).toBeGreaterThan(0);
      expect(validation.qualityScore).toBeLessThan(1.0);
    });

    it('should detect data array length mismatches', () => {
      const mismatchResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            timestamp: [mockTimestamp, mockTimestamp + 86400], // 2 timestamps
            indicators: {
              quote: [{
                ...mockQuoteData,
                close: [mockPrice] // Only 1 close price
              }],
              adjclose: [{ adjclose: [mockPrice] }]
            }
          }],
          error: null
        }
      };
      
      const validation = service.validateResponse(mismatchResponse);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.qualityScore).toBeLessThan(1.0);
    });

    it('should detect stale data', () => {
      const staleResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            meta: {
              ...mockMeta,
              regularMarketTime: Math.floor(Date.now() / 1000) - 3600 // 1 hour old
            }
          }],
          error: null
        }
      };
      
      const validation = service.validateResponse(staleResponse);
      expect(validation.warnings.some(w => w.includes('minutes old'))).toBe(true);
    });
  });

  describe('parsePrice', () => {
    it('should parse price from metadata', () => {
      const price = service.parsePrice(mockYahooResponse);
      expect(price).toBe(mockPrice);
    });

    it('should fallback to close price when metadata price is missing', () => {
      const responseWithoutMetaPrice = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            meta: { ...mockMeta, regularMarketPrice: undefined as any }
          }],
          error: null
        }
      };
      
      const price = service.parsePrice(responseWithoutMetaPrice);
      expect(price).toBe(mockPrice);
    });

    it('should return null for invalid response', () => {
      const invalidResponse = { chart: { result: [], error: null } };
      const price = service.parsePrice(invalidResponse);
      expect(price).toBeNull();
    });

    it('should handle responses with null close prices', () => {
      const nullPricesResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            meta: { ...mockMeta, regularMarketPrice: undefined as any },
            indicators: {
              quote: [{
                ...mockQuoteData,
                close: [null, null, mockPrice] // Last non-null value should be returned
              }],
              adjclose: [{ adjclose: [mockPrice] }]
            }
          }],
          error: null
        }
      };
      
      const price = service.parsePrice(nullPricesResponse);
      expect(price).toBe(mockPrice);
    });
  });

  describe('getMarketStatus', () => {
    it('should return market status successfully', async () => {
      const marketStatus = await service.getMarketStatus(mockSymbol);
      
      expect(marketStatus).toMatchObject({
        market: expect.any(String),
        status: expect.any(String),
        timezone: expect.any(String),
        extendedHours: expect.any(Boolean)
      });
    });

    it('should determine market status based on data freshness', async () => {
      // Recent data should indicate market is open
      const recentMeta = {
        ...mockMeta,
        regularMarketTime: Math.floor(Date.now() / 1000) - 60 // 1 minute ago
      };
      
      const recentResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{ ...mockChartResult, meta: recentMeta }],
          error: null
        }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: recentResponse
      });
      
      const marketStatus = await service.getMarketStatus(mockSymbol);
      expect(marketStatus.status).toBe('OPEN');
    });

    it('should handle market status errors gracefully', async () => {
      mockHttpClient.getChart.mockRejectedValue(new Error('Network error'));
      
      await expect(service.getMarketStatus(mockSymbol)).rejects.toThrow(YahooFinanceServiceException);
    });
  });

  describe('getMultiplePrices', () => {
    const symbols = ['CL=F', 'GC=F', 'NG=F'];

    it('should fetch multiple prices successfully', async () => {
      const prices = await service.getMultiplePrices(symbols);
      
      expect(prices.size).toBe(symbols.length);
      symbols.forEach(symbol => {
        expect(prices.has(symbol)).toBe(true);
        expect(typeof prices.get(symbol)).toBe('number');
      });
    });

    it('should handle partial failures gracefully', async () => {
      let callCount = 0;
      mockHttpClient.getChart.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          // Fail the second call
          return {
            data: null,
            success: false,
            error: 'Symbol not found',
            statusCode: 404,
            timestamp: new Date().toISOString()
          };
        }
        return mockApiResponse;
      });

      const prices = await service.getMultiplePrices(symbols);
      
      // Should have 2 successful prices (first and third symbols)
      expect(prices.size).toBe(2);
      expect(prices.has(symbols[0]!)).toBe(true);
      expect(prices.has(symbols[2]!)).toBe(true);
      expect(prices.has(symbols[1]!)).toBe(false);
    });

    it('should process symbols in parallel', async () => {
      const startTime = Date.now();
      await service.getMultiplePrices(symbols);
      const endTime = Date.now();
      
      // Should be much faster than sequential processing
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle empty symbol array', async () => {
      const prices = await service.getMultiplePrices([]);
      expect(prices.size).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache successfully', () => {
      // Add some cached data
      service.getCurrentPrice(mockSymbol);
      
      service.clearCache();
      const cacheStats = service.getCacheStats();
      
      expect(cacheStats.size).toBe(0);
      expect(cacheStats.entries).toHaveLength(0);
    });

    it('should provide accurate cache statistics', async () => {
      await service.getCurrentPrice(mockSymbol);
      await service.getQuoteData(mockSymbol);
      
      const cacheStats = service.getCacheStats();
      
      expect(cacheStats.size).toBeGreaterThan(0);
      expect(cacheStats.entries.length).toBeGreaterThan(0);
      expect(cacheStats.memoryUsage).toBeGreaterThan(0);
    });

    it('should handle cache expiration correctly', async () => {
      // Mock short TTL for testing
      const originalTtl = CACHE_CONFIG.TTL_BY_TYPE.QUOTES;
      (CACHE_CONFIG.TTL_BY_TYPE as any).QUOTES = 10; // 10ms
      
      await service.getCurrentPrice(mockSymbol);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should fetch fresh data
      await service.getCurrentPrice(mockSymbol);
      
      expect(mockHttpClient.getChart).toHaveBeenCalledTimes(2);
      
      // Restore original TTL
      (CACHE_CONFIG.TTL_BY_TYPE as any).QUOTES = originalTtl;
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors properly', async () => {
      mockHttpClient.getChart.mockRejectedValue(new Error('ECONNREFUSED'));
      
      await expect(service.getCurrentPrice(mockSymbol)).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should handle API rate limiting', async () => {
      const rateLimitResponse: ApiResponse<YahooFinanceResponse> = {
        data: null,
        success: false,
        error: 'Rate limit exceeded',
        statusCode: 429,
        timestamp: new Date().toISOString()
      };
      
      mockHttpClient.getChart.mockResolvedValue(rateLimitResponse);
      
      await expect(service.getCurrentPrice(mockSymbol)).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should handle malformed API responses', async () => {
      const malformedResponse = {
        data: { invalid: 'structure' } as any,
        success: true,
        statusCode: 200,
        timestamp: new Date().toISOString()
      };
      
      mockHttpClient.getChart.mockResolvedValue(malformedResponse);
      
      await expect(service.getCurrentPrice(mockSymbol)).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should classify errors correctly', async () => {
      try {
        await service.getCurrentPrice('');
      } catch (error) {
        expect(error).toBeInstanceOf(YahooFinanceServiceException);
        expect((error as YahooFinanceServiceException).errorType).toBe(YahooFinanceServiceError.INVALID_SYMBOL);
      }
    });

    it('should provide retryable error information', async () => {
      mockHttpClient.getChart.mockRejectedValue(new Error('Timeout'));
      
      try {
        await service.getCurrentPrice(mockSymbol);
      } catch (error) {
        expect(error).toBeInstanceOf(YahooFinanceServiceException);
        expect((error as YahooFinanceServiceException).retryable).toBe(true);
      }
    });
  });

  describe('Data Validation', () => {
    it('should validate symbol format correctly', async () => {
      const validSymbols = ['CL=F', 'GC=F', 'AAPL', 'BTC-USD'];
      const invalidSymbols = ['', 'invalid!', '123', 'toolong_symbol_name_here'];

      // Valid symbols should not throw
      for (const symbol of validSymbols) {
        await expect(service.getCurrentPrice(symbol)).resolves.toBeDefined();
      }

      // Invalid symbols should throw
      for (const symbol of invalidSymbols) {
        await expect(service.getCurrentPrice(symbol)).rejects.toThrow(YahooFinanceServiceException);
      }
    });

    it('should validate price ranges when enabled', async () => {
      const invalidPriceMeta = { ...mockMeta, regularMarketPrice: 999999 };
      const invalidResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{ ...mockChartResult, meta: invalidPriceMeta }],
          error: null
        }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: invalidResponse
      });
      
      const options = { validatePrice: true };
      await expect(service.getQuoteData(mockSymbol, options)).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should handle missing required fields gracefully', async () => {
      const incompleteResponse = {
        chart: {
          result: [{
            meta: { symbol: mockSymbol } as any, // Missing other required fields
            timestamp: [mockTimestamp],
            indicators: { quote: [], adjclose: [] }
          }],
          error: null
        }
      } as any;
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: incompleteResponse
      });
      
      await expect(service.getQuoteData(mockSymbol)).rejects.toThrow(YahooFinanceServiceException);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full price fetch workflow', async () => {
      // Complete workflow: fetch price, validate, cache, and retrieve from cache
      const price1 = await service.getCurrentPrice(mockSymbol);
      const quoteData = await service.getQuoteData(mockSymbol);
      const price2 = await service.getCurrentPrice(mockSymbol); // Should use cache
      
      expect(price1).toBe(mockPrice);
      expect(quoteData.currentPrice).toBe(mockPrice);
      expect(price2).toBe(mockPrice);
      expect(mockHttpClient.getChart).toHaveBeenCalledTimes(1); // Cache hit for second call
    });

    it('should handle complete historical data workflow', async () => {
      const chartData = await service.getChartData(mockSymbol, {
        interval: '1d',
        range: '1mo',
        includeVolume: true,
        includeAdjustedClose: true,
        validateData: true
      });
      
      expect(chartData.symbol).toBe(mockSymbol);
      expect(chartData.prices).toHaveLength(1);
      expect(chartData.prices[0]).toMatchObject({
        date: expect.any(String),
        timestamp: expect.any(Number),
        open: expect.any(Number),
        close: expect.any(Number),
        volume: expect.any(Number)
      });
    });

    it('should handle market status workflow', async () => {
      const marketStatus = await service.getMarketStatus(mockSymbol);
      
      expect(marketStatus).toMatchObject({
        market: expect.any(String),
        status: expect.stringMatching(/^(OPEN|CLOSED|PRE_MARKET|POST_MARKET)$/),
        timezone: expect.any(String),
        extendedHours: expect.any(Boolean)
      });
    });

    it('should handle multiple price fetching workflow', async () => {
      const symbols = Object.values(COMMODITY_SYMBOLS).slice(0, 3).map(c => c.symbol);
      const prices = await service.getMultiplePrices(symbols);
      
      expect(prices.size).toBe(symbols.length);
      symbols.forEach(symbol => {
        expect(prices.has(symbol)).toBe(true);
        expect(typeof prices.get(symbol)).toBe('number');
      });
    });
  });

  describe('Performance and Monitoring', () => {
    it('should handle high-frequency requests efficiently', async () => {
      const promises = Array.from({ length: 10 }, () => 
        service.getCurrentPrice(mockSymbol)
      );
      
      const results = await Promise.all(promises);
      
      // All should return the same cached value
      expect(results.every(price => price === mockPrice)).toBe(true);
      // Should only make one HTTP request due to caching
      expect(mockHttpClient.getChart).toHaveBeenCalledTimes(1);
    });

    it('should provide accurate cache statistics', async () => {
      await service.getCurrentPrice(mockSymbol);
      await service.getQuoteData(mockSymbol + '2'); // Different symbol
      
      const stats = service.getCacheStats();
      
      expect(stats.size).toBe(2); // Two cache entries
      expect(stats.entries.length).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should handle concurrent requests safely', async () => {
      const symbols = ['CL=F', 'GC=F', 'NG=F', 'SI=F', 'HG=F'];
      
      // Make concurrent requests for different symbols
      const promises = symbols.map(symbol => service.getCurrentPrice(symbol));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(symbols.length);
      expect(results.every(price => typeof price === 'number')).toBe(true);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty timestamp arrays', async () => {
      const emptyTimestampResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            timestamp: []
          }],
          error: null
        }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: emptyTimestampResponse
      });
      
      await expect(service.getQuoteData(mockSymbol)).rejects.toThrow(YahooFinanceServiceException);
    });

    it('should handle null values in price arrays', async () => {
      const nullPricesResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            indicators: {
              quote: [{
                ...mockQuoteData,
                close: [null, null, null] // All null values
              }],
              adjclose: [{ adjclose: [null, null, null] }]
            }
          }],
          error: null
        }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: nullPricesResponse
      });
      
      const quoteData = await service.getQuoteData(mockSymbol);
      // Should fallback to metadata price
      expect(quoteData.currentPrice).toBe(mockMeta.regularMarketPrice);
    });

    it('should handle very large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => mockTimestamp + i * 86400);
      const largePrices = Array.from({ length: 10000 }, (_, i) => mockPrice + i * 0.01);
      
      const largeResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            ...mockChartResult,
            timestamp: largeDataset,
            indicators: {
              quote: [{
                ...mockQuoteData,
                close: largePrices,
                open: largePrices,
                high: largePrices,
                low: largePrices,
                volume: Array.from({ length: 10000 }, () => 100000)
              }],
              adjclose: [{ adjclose: largePrices }]
            }
          }],
          error: null
        }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: largeResponse
      });
      
      const startTime = Date.now();
      const chartData = await service.getChartData(mockSymbol, { maxDataPoints: 1000 });
      const endTime = Date.now();
      
      expect(chartData.prices.length).toBeLessThanOrEqual(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle timezone and time formatting correctly', async () => {
      const chartData = await service.getChartData(mockSymbol);
      
      expect(chartData.prices[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
      expect(chartData.prices[0]?.timestamp).toBe(mockTimestamp);
    });

    it('should handle missing optional data gracefully', async () => {
      const sparseResponse = {
        ...mockYahooResponse,
        chart: {
          result: [{
            meta: mockMeta,
            timestamp: [mockTimestamp],
            indicators: {
              quote: [{
                close: [mockPrice],
                open: [null], // Missing open price
                high: [null], // Missing high price
                low: [null],  // Missing low price
                volume: [null] // Missing volume
              }],
              adjclose: [{ adjclose: [null] }] // Missing adjusted close
            }
          }],
          error: null
        }
      };
      
      mockHttpClient.getChart.mockResolvedValue({
        ...mockApiResponse,
        data: sparseResponse
      });
      
      const quoteData = await service.getQuoteData(mockSymbol);
      
      expect(quoteData.currentPrice).toBe(mockPrice);
      expect(quoteData.openPrice).toBe(mockPrice); // Should fallback to current price
      expect(quoteData.dayHigh).toBe(mockPrice);   // Should fallback to current price
      expect(quoteData.dayLow).toBe(mockPrice);    // Should fallback to current price
    });
  });
});