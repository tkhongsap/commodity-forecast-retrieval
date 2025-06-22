/**
 * Yahoo Finance Service Module
 * 
 * Core service module that handles price fetching functionality using the HTTP client,
 * configuration, and TypeScript interfaces. Provides methods for fetching current prices,
 * quotes, and chart data with proper error handling, logging, and validation.
 * 
 * Features:
 * - Type-safe method signatures using TypeScript interfaces
 * - Comprehensive error handling and logging
 * - Rate limiting and caching integration points
 * - Data validation and parsing
 * - Extensible design for multiple commodities
 * - Integration with HTTP client and configuration modules
 * 
 * @author Yahoo Finance Service Module
 * @version 1.0.0
 */

import { getHttpClient, YahooFinanceHttpClient } from '../utils/http-client';
import { 
  YahooFinanceResponse, 
  YahooFinancePriceData,
  ChartResult,
  HistoricalData,
  HistoricalPricePoint,
  YahooFinanceParams,
  YahooFinanceValidation,
  MarketStatus
} from '../types/yahoo-finance';
import { 
  getCommodityConfig,
  getValidationRules,
  VALIDATION_RULES,
  TIME_CONFIG,
  CACHE_CONFIG,
  CommoditySymbolKey
} from '../config/yahoo-finance';

/**
 * Service error types for specific Yahoo Finance operations
 */
export enum YahooFinanceServiceError {
  INVALID_SYMBOL = 'INVALID_SYMBOL',
  DATA_PARSING_ERROR = 'DATA_PARSING_ERROR',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NO_DATA_AVAILABLE = 'NO_DATA_AVAILABLE',
  PRICE_OUT_OF_RANGE = 'PRICE_OUT_OF_RANGE',
  STALE_DATA = 'STALE_DATA',
  MARKET_CLOSED = 'MARKET_CLOSED'
}

/**
 * Service-specific error class
 */
export class YahooFinanceServiceException extends Error {
  public readonly errorType: YahooFinanceServiceError;
  public readonly symbol: string | undefined;
  public readonly statusCode: number | undefined;
  public readonly retryable: boolean;

  constructor(
    errorType: YahooFinanceServiceError,
    message: string,
    symbol?: string,
    statusCode?: number,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'YahooFinanceServiceException';
    this.errorType = errorType;
    this.symbol = symbol;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

/**
 * Quote data request options
 */
export interface QuoteOptions {
  /** Include extended hours data */
  includeExtendedHours?: boolean;
  /** Include dividend and split information */
  includeEvents?: boolean;
  /** Validate price against expected ranges */
  validatePrice?: boolean;
  /** Cache the result */
  useCache?: boolean;
}

/**
 * Chart data request options
 */
export interface ChartOptions extends YahooFinanceParams {
  /** Validate historical data */
  validateData?: boolean;
  /** Maximum number of data points to return */
  maxDataPoints?: number;
  /** Include volume data */
  includeVolume?: boolean;
  /** Include adjusted close prices */
  includeAdjustedClose?: boolean;
}

/**
 * Yahoo Finance Service Class
 * 
 * Main service class that provides methods for fetching and processing
 * Yahoo Finance data for commodities and financial instruments.
 */
export class YahooFinanceService {
  private httpClient: YahooFinanceHttpClient;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private logger: Console;

  constructor(httpClient?: YahooFinanceHttpClient) {
    this.httpClient = httpClient || getHttpClient();
    this.cache = new Map();
    this.logger = console;
    
    // Setup cache cleanup interval
    this.setupCacheCleanup();
  }

  /**
   * Get current price for a commodity symbol
   * 
   * @param symbol - Yahoo Finance symbol (e.g., 'CL=F', 'GC=F')
   * @returns Promise resolving to current price as number
   * @throws YahooFinanceServiceException on errors
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      this.logger.log(`[YahooFinanceService] Fetching current price for symbol: ${symbol}`);
      
      // Validate symbol
      if (!this.isValidSymbol(symbol)) {
        throw new YahooFinanceServiceException(
          YahooFinanceServiceError.INVALID_SYMBOL,
          `Invalid symbol format: ${symbol}`,
          symbol
        );
      }

      // Check cache first
      const cacheKey = `price:${symbol}`;
      const cachedPrice = this.getFromCache(cacheKey);
      if (cachedPrice !== null) {
        this.logger.log(`[YahooFinanceService] Returning cached price for ${symbol}: ${cachedPrice}`);
        return cachedPrice;
      }

      // Fetch quote data
      const quoteData = await this.getQuoteData(symbol);
      const price = quoteData.currentPrice;

      // Cache the result
      this.setCache(cacheKey, price, CACHE_CONFIG.TTL_BY_TYPE.QUOTES);

      this.logger.log(`[YahooFinanceService] Successfully fetched current price for ${symbol}: ${price}`);
      return price;

    } catch (error) {
      if (error instanceof YahooFinanceServiceException) {
        throw error;
      }
      
      this.logger.error(`[YahooFinanceService] Error fetching current price for ${symbol}:`, error);
      throw new YahooFinanceServiceException(
        YahooFinanceServiceError.DATA_PARSING_ERROR,
        `Failed to fetch current price: ${(error as Error).message}`,
        symbol,
        undefined,
        true
      );
    }
  }

  /**
   * Get comprehensive quote data for a symbol
   * 
   * @param symbol - Yahoo Finance symbol
   * @param options - Quote request options
   * @returns Promise resolving to YahooFinancePriceData
   */
  async getQuoteData(symbol: string, options: QuoteOptions = {}): Promise<YahooFinancePriceData> {
    try {
      this.logger.log(`[YahooFinanceService] Fetching quote data for symbol: ${symbol}`);

      // Validate symbol
      if (!this.isValidSymbol(symbol)) {
        throw new YahooFinanceServiceException(
          YahooFinanceServiceError.INVALID_SYMBOL,
          `Invalid symbol format: ${symbol}`,
          symbol
        );
      }

      // Check cache if enabled
      const cacheKey = `quote:${symbol}:${JSON.stringify(options)}`;
      if (options.useCache !== false) {
        const cachedData = this.getFromCache(cacheKey);
        if (cachedData) {
          this.logger.log(`[YahooFinanceService] Returning cached quote data for ${symbol}`);
          return cachedData;
        }
      }

      // Fetch chart data with minimal range for current quote
      const chartResponse = await this.httpClient.getChart(symbol, '1d', '1d');
      
      if (!chartResponse.success || !chartResponse.data) {
        throw new YahooFinanceServiceException(
          YahooFinanceServiceError.NO_DATA_AVAILABLE,
          `No data available for symbol: ${symbol}`,
          symbol,
          chartResponse.statusCode
        );
      }

      // Validate and parse response
      const validationResult = this.validateResponse(chartResponse.data);
      if (!validationResult.isValid) {
        throw new YahooFinanceServiceException(
          YahooFinanceServiceError.VALIDATION_FAILED,
          `Data validation failed: ${validationResult.errors.join(', ')}`,
          symbol
        );
      }

      // Extract quote data
      const chartResult = chartResponse.data.chart.result[0];
      if (!chartResult) {
        throw new YahooFinanceServiceException(
          YahooFinanceServiceError.NO_DATA_AVAILABLE,
          `No chart result data for symbol: ${symbol}`,
          symbol
        );
      }
      const quoteData = this.parseQuoteData(chartResult);

      // Validate price if requested
      if (options.validatePrice) {
        this.validatePriceRange(quoteData.currentPrice, symbol);
      }

      // Cache the result
      if (options.useCache !== false) {
        this.setCache(cacheKey, quoteData, CACHE_CONFIG.TTL_BY_TYPE.QUOTES);
      }

      this.logger.log(`[YahooFinanceService] Successfully fetched quote data for ${symbol}`);
      return quoteData;

    } catch (error) {
      if (error instanceof YahooFinanceServiceException) {
        throw error;
      }
      
      this.logger.error(`[YahooFinanceService] Error fetching quote data for ${symbol}:`, error);
      throw new YahooFinanceServiceException(
        YahooFinanceServiceError.DATA_PARSING_ERROR,
        `Failed to fetch quote data: ${(error as Error).message}`,
        symbol,
        undefined,
        true
      );
    }
  }

  /**
   * Get historical chart data for a symbol
   * 
   * @param symbol - Yahoo Finance symbol
   * @param options - Chart request options
   * @returns Promise resolving to HistoricalData
   */
  async getChartData(symbol: string, options: ChartOptions = {}): Promise<HistoricalData> {
    try {
      this.logger.log(`[YahooFinanceService] Fetching chart data for symbol: ${symbol} with options:`, options);

      // Validate symbol
      if (!this.isValidSymbol(symbol)) {
        throw new YahooFinanceServiceException(
          YahooFinanceServiceError.INVALID_SYMBOL,
          `Invalid symbol format: ${symbol}`,
          symbol
        );
      }

      // Set default options
      const {
        interval = TIME_CONFIG.DEFAULTS.DAILY_INTERVAL,
        range = TIME_CONFIG.DEFAULTS.DEFAULT_RANGE,
        includeVolume = true,
        includeAdjustedClose = true,
        validateData = true,
        maxDataPoints = 1000
      } = options;

      // Check cache
      const cacheKey = `chart:${symbol}:${interval}:${range}`;
      const cachedData = this.getFromCache(cacheKey);
      if (cachedData) {
        this.logger.log(`[YahooFinanceService] Returning cached chart data for ${symbol}`);
        return cachedData;
      }

      // Fetch chart data
      const chartResponse = await this.httpClient.getChart(symbol, interval, range);
      
      if (!chartResponse.success || !chartResponse.data) {
        throw new YahooFinanceServiceException(
          YahooFinanceServiceError.NO_DATA_AVAILABLE,
          `No chart data available for symbol: ${symbol}`,
          symbol,
          chartResponse.statusCode
        );
      }

      // Validate response
      if (validateData) {
        const validationResult = this.validateResponse(chartResponse.data);
        if (!validationResult.isValid) {
          this.logger.warn(`[YahooFinanceService] Data validation warnings for ${symbol}:`, validationResult.warnings);
        }
      }

      // Parse historical data
      const chartResult = chartResponse.data.chart.result[0];
      if (!chartResult) {
        throw new YahooFinanceServiceException(
          YahooFinanceServiceError.NO_DATA_AVAILABLE,
          `No chart result data for symbol: ${symbol}`,
          symbol
        );
      }
      const historicalData = this.parseHistoricalData(
        chartResult,
        symbol,
        interval,
        range,
        maxDataPoints,
        includeVolume,
        includeAdjustedClose
      );

      // Cache the result
      this.setCache(cacheKey, historicalData, CACHE_CONFIG.TTL_BY_TYPE.HISTORICAL);

      this.logger.log(`[YahooFinanceService] Successfully fetched chart data for ${symbol}, ${historicalData.prices.length} data points`);
      return historicalData;

    } catch (error) {
      if (error instanceof YahooFinanceServiceException) {
        throw error;
      }
      
      this.logger.error(`[YahooFinanceService] Error fetching chart data for ${symbol}:`, error);
      throw new YahooFinanceServiceException(
        YahooFinanceServiceError.DATA_PARSING_ERROR,
        `Failed to fetch chart data: ${(error as Error).message}`,
        symbol,
        undefined,
        true
      );
    }
  }

  /**
   * Validate Yahoo Finance API response
   * 
   * @param response - Yahoo Finance response object
   * @returns Validation result with errors and warnings
   */
  validateResponse(response: YahooFinanceResponse): YahooFinanceValidation {
    const validation: YahooFinanceValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      missingFields: [],
      qualityScore: 1.0
    };

    try {
      // Check basic response structure
      if (!response.chart) {
        validation.errors.push('Missing chart data in response');
        validation.isValid = false;
        return validation;
      }

      if (!response.chart.result || response.chart.result.length === 0) {
        validation.errors.push('No chart results in response');
        validation.isValid = false;
        return validation;
      }

      // Check for API errors
      if (response.chart.error) {
        validation.errors.push(`API Error: ${response.chart.error.description}`);
        validation.isValid = false;
        return validation;
      }

      const result = response.chart.result[0];
      if (!result) {
        validation.errors.push('No chart result data available');
        validation.isValid = false;
        return validation;
      }

      // Validate metadata
      if (!result.meta) {
        validation.errors.push('Missing metadata in chart result');
        validation.isValid = false;
      } else {
        const requiredMetaFields = VALIDATION_RULES.REQUIRED_FIELDS.METADATA;
        for (const field of requiredMetaFields) {
          if (!(field in result.meta)) {
            validation.missingFields.push(`meta.${field}`);
            validation.qualityScore -= 0.1;
          }
        }
      }

      // Validate timestamp data
      if (!result.timestamp || result.timestamp.length === 0) {
        validation.errors.push('Missing or empty timestamp data');
        validation.isValid = false;
      }

      // Validate indicators
      if (!result.indicators || !result.indicators.quote || result.indicators.quote.length === 0) {
        validation.errors.push('Missing quote indicators data');
        validation.isValid = false;
      } else {
        const quote = result.indicators.quote[0];
        const timestampLength = result.timestamp.length;

        // Check data arrays lengths
        if (quote && quote.close && quote.close.length !== timestampLength) {
          validation.warnings.push('Timestamp and close price array length mismatch');
          validation.qualityScore -= 0.1;
        }

        if (quote && quote.open && quote.open.length !== timestampLength) {
          validation.warnings.push('Timestamp and open price array length mismatch');
          validation.qualityScore -= 0.05;
        }

        // Check for null values in critical data
        const nullCloseCount = quote && quote.close ? quote.close.filter(price => price === null).length : 0;
        if (nullCloseCount > 0) {
          validation.warnings.push(`${nullCloseCount} null values in close prices`);
          validation.qualityScore -= (nullCloseCount / timestampLength) * 0.2;
        }
      }

      // Check data freshness
      if (result.meta && result.meta.regularMarketTime) {
        const dataAge = Date.now() - (result.meta.regularMarketTime * 1000);
        const maxAge = VALIDATION_RULES.DATA_FRESHNESS.MAX_REALTIME_AGE_MINUTES * 60 * 1000;
        
        if (dataAge > maxAge) {
          validation.warnings.push(`Data is ${Math.floor(dataAge / 60000)} minutes old`);
          validation.qualityScore -= 0.1;
        }
      }

      // Ensure quality score doesn't go below 0
      validation.qualityScore = Math.max(0, validation.qualityScore);

    } catch (error) {
      validation.errors.push(`Validation error: ${(error as Error).message}`);
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Parse current price from Yahoo Finance response
   * 
   * @param response - Yahoo Finance response
   * @returns Current price or null if parsing fails
   */
  parsePrice(response: YahooFinanceResponse): number | null {
    try {
      const result = response.chart?.result?.[0];
      if (!result) return null;

      // Try to get current price from metadata first
      if (result.meta?.regularMarketPrice) {
        return result.meta.regularMarketPrice;
      }

      // Fall back to latest close price from indicators
      const quote = result.indicators?.quote?.[0];
      if (quote?.close && quote.close.length > 0) {
        // Get the most recent non-null close price
        for (let i = quote.close.length - 1; i >= 0; i--) {
          if (quote.close[i] !== null) {
            return quote.close[i]!;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error('[YahooFinanceService] Error parsing price:', error);
      return null;
    }
  }

  /**
   * Get market status for a symbol
   * 
   * @param symbol - Yahoo Finance symbol
   * @returns Promise resolving to market status information
   */
  async getMarketStatus(symbol: string): Promise<MarketStatus> {
    try {
      const quoteData = await this.getQuoteData(symbol);
      const commodityConfig = getCommodityConfig(symbol);
      
      const currentTime = new Date();
      const marketTime = new Date(quoteData.lastUpdated);
      const timeDiff = currentTime.getTime() - marketTime.getTime();
      
      // Determine market status based on data freshness and time
      let status: MarketStatus['status'] = 'CLOSED';
      
      // If data is very recent (less than 5 minutes), market is likely open
      if (timeDiff < 5 * 60 * 1000) {
        status = 'OPEN';
      } else if (timeDiff < 30 * 60 * 1000) {
        // Data is somewhat recent, could be pre/post market
        const hour = currentTime.getUTCHours();
        if (hour >= 13 && hour < 21) { // Rough estimate for US market hours
          status = 'OPEN';
        } else {
          status = 'PRE_MARKET';
        }
      }

      return {
        market: commodityConfig?.exchange || quoteData.exchange,
        status,
        timezone: 'America/New_York', // Default to NYSE timezone
        extendedHours: true // Most commodity markets have extended hours
      };

    } catch (error) {
      this.logger.error(`[YahooFinanceService] Error getting market status for ${symbol}:`, error);
      throw new YahooFinanceServiceException(
        YahooFinanceServiceError.NO_DATA_AVAILABLE,
        `Failed to get market status: ${(error as Error).message}`,
        symbol
      );
    }
  }

  /**
   * Get multiple commodity prices efficiently
   * 
   * @param symbols - Array of Yahoo Finance symbols
   * @returns Promise resolving to map of symbol -> price
   */
  async getMultiplePrices(symbols: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    const errors = new Map<string, Error>();

    // Process symbols in parallel with error handling
    const promises = symbols.map(async (symbol) => {
      try {
        const price = await this.getCurrentPrice(symbol);
        results.set(symbol, price);
      } catch (error) {
        errors.set(symbol, error as Error);
        this.logger.warn(`[YahooFinanceService] Failed to fetch price for ${symbol}:`, error);
      }
    });

    await Promise.allSettled(promises);

    // Log summary
    this.logger.log(`[YahooFinanceService] Fetched ${results.size} prices successfully, ${errors.size} failures`);
    
    if (errors.size > 0) {
      this.logger.warn('[YahooFinanceService] Failed symbols:', Array.from(errors.keys()));
    }

    return results;
  }

  /**
   * Clear service cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('[YahooFinanceService] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      memoryUsage: JSON.stringify(Array.from(this.cache.values())).length
    };
  }

  // Private helper methods

  /**
   * Validate symbol format
   */
  private isValidSymbol(symbol: string): boolean {
    if (!symbol || typeof symbol !== 'string') return false;
    
    // Basic validation - should be at least 2 characters and contain valid characters
    const symbolRegex = /^[A-Z0-9=\-\.]{2,20}$/;
    return symbolRegex.test(symbol.toUpperCase());
  }

  /**
   * Validate price against expected ranges
   */
  private validatePriceRange(price: number, symbol: string): void {
    const commodityConfig = getCommodityConfig(symbol);
    if (!commodityConfig) return; // Skip validation for unknown symbols

    const validationRules = getValidationRules(commodityConfig.symbol as CommoditySymbolKey);
    if (!validationRules) return;

    if (price < validationRules.min || price > validationRules.max) {
      throw new YahooFinanceServiceException(
        YahooFinanceServiceError.PRICE_OUT_OF_RANGE,
        `Price ${price} for ${symbol} is outside expected range [${validationRules.min}, ${validationRules.max}]`,
        symbol
      );
    }

    // Check warning thresholds
    if (price < validationRules.warningThresholds.low || price > validationRules.warningThresholds.high) {
      this.logger.warn(`[YahooFinanceService] Price ${price} for ${symbol} is outside normal range [${validationRules.warningThresholds.low}, ${validationRules.warningThresholds.high}]`);
    }
  }

  /**
   * Parse quote data from chart result
   */
  private parseQuoteData(chartResult: ChartResult): YahooFinancePriceData {
    const meta = chartResult.meta;
    const quote = chartResult.indicators.quote[0];

    if (!quote) {
      throw new YahooFinanceServiceException(
        YahooFinanceServiceError.DATA_PARSING_ERROR,
        'No quote data available in chart result',
        meta.symbol
      );
    }

    // Get latest non-null values
    let currentPrice = meta.regularMarketPrice;
    let volume = meta.regularMarketVolume;
    let openPrice = meta.regularMarketOpen || null;
    let dayHigh = meta.regularMarketDayHigh;
    let dayLow = meta.regularMarketDayLow;

    // If metadata doesn't have the values, get from arrays
    if (!currentPrice && quote.close) {
      currentPrice = this.getLatestNonNull(quote.close) || 0;
    }
    if (!openPrice && quote.open) {
      openPrice = this.getLatestNonNull(quote.open) || currentPrice;
    }
    if (!dayHigh && quote.high) {
      dayHigh = this.getLatestNonNull(quote.high) || currentPrice;
    }
    if (!dayLow && quote.low) {
      dayLow = this.getLatestNonNull(quote.low) || currentPrice;
    }
    if (!volume && quote.volume) {
      volume = this.getLatestNonNull(quote.volume) || 0;
    }

    // Calculate price changes
    const previousClose = meta.chartPreviousClose || meta.regularMarketPreviousClose || currentPrice;
    const priceChange = currentPrice - previousClose;
    const percentChange = previousClose !== 0 ? (priceChange / previousClose) * 100 : 0;

    return {
      currentPrice,
      previousClose,
      openPrice: openPrice || currentPrice,
      dayHigh: dayHigh || currentPrice,
      dayLow: dayLow || currentPrice,
      volume: volume || 0,
      yearHigh: meta.fiftyTwoWeekHigh || currentPrice,
      yearLow: meta.fiftyTwoWeekLow || currentPrice,
      priceChange,
      percentChange,
      currency: meta.currency,
      symbol: meta.symbol,
      lastUpdated: new Date(meta.regularMarketTime * 1000).toISOString(),
      exchange: meta.exchangeName,
      instrumentType: meta.instrumentType
    };
  }

  /**
   * Parse historical data from chart result
   */
  private parseHistoricalData(
    chartResult: ChartResult,
    symbol: string,
    interval: string,
    range: string,
    maxDataPoints: number,
    includeVolume: boolean,
    includeAdjustedClose: boolean
  ): HistoricalData {
    const timestamps = chartResult.timestamp;
    const quote = chartResult.indicators.quote[0];
    const adjClose = chartResult.indicators.adjclose?.[0];

    if (!quote) {
      throw new YahooFinanceServiceException(
        YahooFinanceServiceError.DATA_PARSING_ERROR,
        'No quote data available in chart result',
        symbol
      );
    }

    const prices: HistoricalPricePoint[] = [];
    const dataLength = Math.min(timestamps.length, maxDataPoints);

    for (let i = 0; i < dataLength; i++) {
      const timestamp = timestamps[i];
      if (timestamp === undefined) continue;
      
      const date = new Date(timestamp * 1000);

      const pricePoint: HistoricalPricePoint = {
        date: date.toISOString().split('T')[0] || '', // YYYY-MM-DD format
        timestamp,
        open: quote.open?.[i] || null,
        high: quote.high?.[i] || null,
        low: quote.low?.[i] || null,
        close: quote.close?.[i] || null,
        adjClose: includeAdjustedClose ? (adjClose?.adjclose?.[i] || null) : null,
        volume: includeVolume ? (quote.volume?.[i] || null) : null
      };

      prices.push(pricePoint);
    }

    return {
      symbol,
      interval,
      range,
      prices,
      meta: chartResult.meta
    };
  }

  /**
   * Get latest non-null value from array
   */
  private getLatestNonNull<T>(array: (T | null)[]): T | null {
    for (let i = array.length - 1; i >= 0; i--) {
      const value = array[i];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return null;
  }

  /**
   * Cache management methods
   */
  private getFromCache(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private setupCacheCleanup(): void {
    // Clean expired cache entries every 10 minutes
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      this.cache.forEach((entry, key) => {
        if (now > entry.timestamp + entry.ttl) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => this.cache.delete(key));
    }, CACHE_CONFIG.CLEANUP_INTERVAL);
  }
}

/**
 * Singleton service instance
 */
let serviceInstance: YahooFinanceService | null = null;

/**
 * Get singleton Yahoo Finance service instance
 * 
 * @returns YahooFinanceService instance
 */
export function getYahooFinanceService(): YahooFinanceService {
  if (!serviceInstance) {
    serviceInstance = new YahooFinanceService();
  }
  return serviceInstance;
}

/**
 * Create new Yahoo Finance service instance
 * 
 * @param httpClient - Optional HTTP client instance
 * @returns New YahooFinanceService instance
 */
export function createYahooFinanceService(httpClient?: YahooFinanceHttpClient): YahooFinanceService {
  return new YahooFinanceService(httpClient);
}

/**
 * Default export
 */
export default YahooFinanceService;