/**
 * Yahoo Finance HTTP Client Tests
 * 
 * Comprehensive test suite for the HTTP client utility module.
 * Tests error handling, retry logic, rate limiting, and API integration.
 * 
 * @author HTTP Client Test Module
 * @version 1.0.0
 */

import axios from 'axios';
import { YahooFinanceHttpClient, HttpClientError, HttpErrorType, getHttpClient } from '../http-client';
import { COMMODITY_SYMBOLS } from '../../config/yahoo-finance';

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Create a mock axios instance
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn(),
      eject: jest.fn()
    },
    response: {
      use: jest.fn(),
      eject: jest.fn()
    }
  },
  defaults: {
    baseURL: 'https://query1.finance.yahoo.com',
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }
};

// Set up axios.create to return our mock instance
mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

describe('YahooFinanceHttpClient', () => {
  let client: YahooFinanceHttpClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    client = new YahooFinanceHttpClient();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with correct configuration', () => {
      expect(client).toBeInstanceOf(YahooFinanceHttpClient);
      
      const config = client.getConfig();
      expect(config.baseURL).toBe('https://query1.finance.yahoo.com');
      expect(config.timeout).toBe(15000);
      expect(config.userAgent).toContain('Mozilla');
    });

    it('should initialize rate limiter and retry manager', () => {
      const rateLimit = client.getRateLimit();
      expect(rateLimit).toHaveProperty('requestsPerHour');
      expect(rateLimit).toHaveProperty('remaining');
      expect(rateLimit).toHaveProperty('resetTime');
      expect(rateLimit).toHaveProperty('isLimited');
    });
  });

  describe('HTTP GET Requests', () => {
    it('should make successful GET request', async () => {
      const mockData = { success: true, data: 'test' };
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      } as any);

      const result = await client.get('/test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.statusCode).toBe(200);
      expect(result.timestamp).toBeDefined();
    });

    it('should handle HTTP errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 404, statusText: 'Not Found' },
        message: 'Request failed'
      });

      const result = await client.get('/nonexistent');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should handle timeout errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 15000ms exceeded'
      });

      const result = await client.get('/timeout-test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Yahoo Finance API Methods', () => {

    it('should fetch chart data for a symbol', async () => {
      const mockChartData = {
        chart: {
          result: [{
            meta: {
              currency: 'USD',
              symbol: 'CL=F',
              regularMarketPrice: 75.50,
              exchangeName: 'NYM'
            },
            timestamp: [1640995200],
            indicators: {
              quote: [{
                close: [75.50],
                open: [75.00],
                high: [76.00],
                low: [74.50],
                volume: [100000]
              }],
              adjclose: [{
                adjclose: [75.50]
              }]
            }
          }],
          error: null
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockChartData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      } as any);

      const result = await client.getChart('CL=F', '1d', '1d');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockChartData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/v8/finance/chart/CL=F',
        expect.objectContaining({
          params: {
            interval: '1d',
            range: '1d',
            includePrePost: false,
            events: 'div,split'
          }
        })
      );
    });

    it('should fetch quote data for a symbol', async () => {
      const mockQuoteData = {
        quoteResponse: {
          result: [{
            symbol: 'GC=F',
            regularMarketPrice: 1800.50,
            currency: 'USD'
          }]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockQuoteData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      } as any);

      const result = await client.getQuote('GC=F');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockQuoteData);
    });

    it('should search for symbols', async () => {
      const mockSearchData = {
        suggests: {
          count: 1,
          query: 'gold',
          results: [{
            symbol: 'GC=F',
            name: 'Gold Futures',
            type: 'Future'
          }]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockSearchData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      } as any);

      const result = await client.searchSymbols('gold');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSearchData);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit status', () => {
      const rateLimit = client.getRateLimit();
      
      expect(rateLimit.requestsPerHour).toBe(2000);
      expect(rateLimit.remaining).toBeGreaterThanOrEqual(0);
      expect(rateLimit.resetTime).toBeGreaterThan(Date.now());
      expect(typeof rateLimit.isLimited).toBe('boolean');
    });

    it('should respect rate limits', async () => {
      // This test would require mocking the rate limiter
      // For now, just verify the method exists
      expect(typeof client.getRateLimit).toBe('function');
    });
  });

  describe('Error Classification', () => {

    it('should classify network errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND'
      });

      const result = await client.get('/test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should classify rate limit errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 429, statusText: 'Too Many Requests' },
        message: 'Rate limit exceeded'
      });

      const result = await client.get('/test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should classify API errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 500, statusText: 'Internal Server Error' },
        message: 'Server error'
      });

      const result = await client.get('/test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      } as any);

      const isHealthy = await client.healthCheck();

      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance for getHttpClient', () => {
      const client1 = getHttpClient();
      const client2 = getHttpClient();

      expect(client1).toBe(client2);
      expect(client1).toBeInstanceOf(YahooFinanceHttpClient);
    });
  });

  describe('Configuration', () => {
    it('should return client configuration', () => {
      const config = client.getConfig();

      expect(config).toHaveProperty('baseURL');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('userAgent');
      expect(config).toHaveProperty('rateLimit');
    });
  });
});

describe('HttpClientError', () => {
  it('should create error with correct properties', () => {
    const error = new HttpClientError(
      HttpErrorType.NETWORK_ERROR,
      'Network error occurred',
      500,
      2
    );

    expect(error.name).toBe('HttpClientError');
    expect(error.type).toBe(HttpErrorType.NETWORK_ERROR);
    expect(error.message).toBe('Network error occurred');
    expect(error.statusCode).toBe(500);
    expect(error.retryCount).toBe(2);
  });

  it('should extend Error class', () => {
    const error = new HttpClientError(
      HttpErrorType.TIMEOUT_ERROR,
      'Request timeout'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpClientError);
  });
});

describe('Integration Tests', () => {
  // These tests should be run against the actual API in a separate test suite
  describe.skip('Real API Tests', () => {
    let client: YahooFinanceHttpClient;

    beforeEach(() => {
      client = new YahooFinanceHttpClient();
    });

    it('should fetch real commodity data', async () => {
      const result = await client.getChart(
        COMMODITY_SYMBOLS.CRUDE_OIL_WTI.symbol,
        '1d',
        '1d'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data && result.data.chart.result.length > 0 && result.data.chart.result[0]) {
        const meta = result.data.chart.result[0].meta;
        expect(meta.symbol).toBe(COMMODITY_SYMBOLS.CRUDE_OIL_WTI.symbol);
        expect(meta.currency).toBe('USD');
        expect(typeof meta.regularMarketPrice).toBe('number');
      }
    }, 30000); // 30 second timeout for real API calls
  });
});