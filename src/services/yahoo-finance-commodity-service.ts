/**
 * Yahoo Finance Commodity Integration Service
 * 
 * High-level service that integrates Yahoo Finance data fetching with CommodityData
 * parsing for seamless commodity forecasting system integration. This service acts
 * as a bridge between the raw Yahoo Finance API and the existing commodity interfaces.
 * 
 * Features:
 * - Direct conversion from Yahoo Finance to CommodityData format
 * - Integrated error handling and data validation
 * - Source attribution and data quality tracking
 * - Support for multiple commodities
 * - Caching and rate limiting integration
 * - Comprehensive logging and monitoring
 * 
 * @author Yahoo Finance Commodity Integration Service
 * @version 1.0.0
 */

import { 
  CommodityData, 
  CommodityAnalysis,
  SourceInfo,
  ValidationResult,
  CRUDE_OIL_CONFIG
} from '../types/commodity';
import { 
  YahooFinanceResponse,
  YahooFinancePriceData 
} from '../types/yahoo-finance';
import { 
  YahooFinanceService,
  YahooFinanceServiceException,
  YahooFinanceServiceError,
  getYahooFinanceService 
} from './yahoo-finance-service';
import {
  YahooFinanceParser,
  YahooFinanceParserException,
  YahooFinanceParserError,
  ParserOptions,
  SymbolMapping,
  createYahooFinanceParser
} from '../utils/yahoo-finance-parser';

/**
 * Service error types for commodity operations
 */
export enum CommodityServiceError {
  SYMBOL_NOT_SUPPORTED = 'SYMBOL_NOT_SUPPORTED',
  DATA_FETCH_FAILED = 'DATA_FETCH_FAILED',
  PARSING_FAILED = 'PARSING_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  MULTIPLE_FAILURES = 'MULTIPLE_FAILURES',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

/**
 * Commodity service specific error class
 */
export class YahooFinanceCommodityServiceException extends Error {
  public readonly errorType: CommodityServiceError;
  public readonly symbol: string | undefined;
  public readonly underlyingError: Error | undefined;
  public readonly retryable: boolean;

  constructor(
    errorType: CommodityServiceError,
    message: string,
    symbol?: string,
    underlyingError?: Error,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'YahooFinanceCommodityServiceException';
    this.errorType = errorType;
    this.symbol = symbol;
    this.underlyingError = underlyingError;
    this.retryable = retryable;
  }
}

/**
 * Commodity fetching options
 */
export interface CommodityFetchOptions extends ParserOptions {
  /** Use cached data if available */
  useCache?: boolean;
  /** Include extended market data */
  includeExtendedData?: boolean;
  /** Validate price against expected ranges */
  validatePrice?: boolean;
  /** Maximum data age in milliseconds */
  maxDataAge?: number;
  /** Custom timeout for requests */
  requestTimeout?: number;
}

/**
 * Multi-commodity fetching results
 */
export interface MultiCommodityResult {
  /** Successfully fetched commodities */
  success: CommodityData[];
  /** Failed fetches with error information */
  failures: Array<{
    symbol: string;
    error: Error;
    retryable: boolean;
  }>;
  /** Overall success rate */
  successRate: number;
  /** Processing timestamp */
  timestamp: string;
}

/**
 * Commodity service statistics
 */
export interface ServiceStats {
  /** Total requests made */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Success rate percentage */
  successRate: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Most requested symbols */
  topSymbols: Array<{ symbol: string; count: number }>;
}

/**
 * Yahoo Finance Commodity Service
 * 
 * Main service class that provides high-level methods for fetching commodity
 * data in CommodityData format from Yahoo Finance.
 */
export class YahooFinanceCommodityService {
  private yahooService: YahooFinanceService;
  private parser: YahooFinanceParser;
  private logger: Console;
  private stats: ServiceStats;
  private requestLog: Array<{ symbol: string; timestamp: number; success: boolean; responseTime: number }>;

  constructor(
    yahooService?: YahooFinanceService,
    customSymbolMappings?: Record<string, SymbolMapping>
  ) {
    this.yahooService = yahooService || getYahooFinanceService();
    this.parser = createYahooFinanceParser(customSymbolMappings);
    this.logger = console;
    this.stats = this.initializeStats();
    this.requestLog = [];
  }

  /**
   * Get commodity data for a single symbol
   * 
   * @param symbol - Yahoo Finance symbol (e.g., 'CL=F', 'GC=F')
   * @param options - Fetching and parsing options
   * @returns Promise resolving to CommodityData
   * @throws YahooFinanceCommodityServiceException on errors
   */
  async getCommodityData(
    symbol: string,
    options: CommodityFetchOptions = {}
  ): Promise<CommodityData> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`[YahooFinanceCommodityService] Fetching commodity data for ${symbol}`);
      
      // Fetch Yahoo Finance data
      const priceData = await this.yahooService.getQuoteData(symbol, {
        useCache: options.useCache,
        validatePrice: options.validatePrice,
        includeExtendedHours: options.includeExtendedData
      });

      // Convert to CommodityData format
      const commodityData = this.parser.parseFromPriceData(priceData, {
        validateData: options.validateData,
        strictValidation: options.strictValidation,
        includeExtendedMetadata: options.includeExtendedMetadata,
        sourceUrl: options.sourceUrl,
        currencyOverride: options.currencyOverride,
        unitOverride: options.unitOverride
      });

      // Validate data age if specified
      if (options.maxDataAge) {
        this.validateDataAge(commodityData, options.maxDataAge);
      }

      // Update statistics
      const responseTime = Date.now() - startTime;
      this.updateStats(symbol, true, responseTime);

      this.logger.log(`[YahooFinanceCommodityService] Successfully fetched commodity data for ${symbol} (${responseTime}ms)`);
      return commodityData;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(symbol, false, responseTime);

      if (error instanceof YahooFinanceServiceException) {
        throw new YahooFinanceCommodityServiceException(
          CommodityServiceError.DATA_FETCH_FAILED,
          `Failed to fetch data for ${symbol}: ${error.message}`,
          symbol,
          error,
          error.retryable
        );
      }

      if (error instanceof YahooFinanceParserException) {
        throw new YahooFinanceCommodityServiceException(
          CommodityServiceError.PARSING_FAILED,
          `Failed to parse data for ${symbol}: ${error.message}`,
          symbol,
          error,
          false
        );
      }

      this.logger.error(`[YahooFinanceCommodityService] Error fetching commodity data for ${symbol}:`, error);
      throw new YahooFinanceCommodityServiceException(
        CommodityServiceError.SERVICE_UNAVAILABLE,
        `Service error for ${symbol}: ${(error as Error).message}`,
        symbol,
        error as Error,
        true
      );
    }
  }

  /**
   * Get commodity data for multiple symbols
   * 
   * @param symbols - Array of Yahoo Finance symbols
   * @param options - Fetching and parsing options
   * @returns Promise resolving to MultiCommodityResult
   */
  async getMultipleCommodityData(
    symbols: string[],
    options: CommodityFetchOptions = {}
  ): Promise<MultiCommodityResult> {
    this.logger.log(`[YahooFinanceCommodityService] Fetching data for ${symbols.length} commodities`);
    
    const result: MultiCommodityResult = {
      success: [],
      failures: [],
      successRate: 0,
      timestamp: new Date().toISOString()
    };

    // Process symbols in parallel with error handling
    const promises = symbols.map(async (symbol) => {
      try {
        const commodityData = await this.getCommodityData(symbol, options);
        result.success.push(commodityData);
      } catch (error) {
        const isRetryable = error instanceof YahooFinanceCommodityServiceException 
          ? error.retryable 
          : false;
        
        result.failures.push({
          symbol,
          error: error as Error,
          retryable: isRetryable
        });

        this.logger.warn(`[YahooFinanceCommodityService] Failed to fetch data for ${symbol}:`, error);
      }
    });

    await Promise.allSettled(promises);

    // Calculate success rate
    const totalSymbols = symbols.length;
    result.successRate = totalSymbols > 0 ? (result.success.length / totalSymbols) * 100 : 0;

    this.logger.log(`[YahooFinanceCommodityService] Completed multi-commodity fetch: ${result.success.length}/${totalSymbols} successful (${result.successRate.toFixed(1)}%)`);

    return result;
  }

  /**
   * Get current price for a commodity symbol
   * 
   * @param symbol - Yahoo Finance symbol
   * @param options - Fetching options
   * @returns Promise resolving to current price
   */
  async getCurrentPrice(symbol: string, options: CommodityFetchOptions = {}): Promise<number> {
    try {
      const commodityData = await this.getCommodityData(symbol, options);
      return commodityData.currentPrice;
    } catch (error) {
      this.logger.error(`[YahooFinanceCommodityService] Error getting current price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Validate commodity data against business rules
   * 
   * @param commodityData - CommodityData to validate
   * @returns ValidationResult with detailed validation information
   */
  validateCommodityData(commodityData: CommodityData): ValidationResult {
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Basic field validation
      if (!commodityData.symbol) {
        validation.errors.push('Missing symbol');
      }

      if (!commodityData.name) {
        validation.errors.push('Missing commodity name');
      }

      if (commodityData.currentPrice <= 0) {
        validation.errors.push('Invalid current price');
      }

      if (!commodityData.currency) {
        validation.errors.push('Missing currency');
      }

      if (!commodityData.unit) {
        validation.errors.push('Missing unit');
      }

      // Source validation
      if (!commodityData.sources || commodityData.sources.length === 0) {
        validation.errors.push('Missing source information');
      } else {
        const yahooSource = commodityData.sources.find(source => 
          source.name === 'Yahoo Finance'
        );
        if (!yahooSource) {
          validation.warnings.push('No Yahoo Finance source attribution found');
        }
      }

      // Data quality checks
      const lastUpdated = new Date(commodityData.lastUpdated);
      const dataAge = Date.now() - lastUpdated.getTime();
      
      if (isNaN(lastUpdated.getTime())) {
        validation.errors.push('Invalid lastUpdated timestamp');
      } else if (dataAge > 24 * 60 * 60 * 1000) { // More than 24 hours
        validation.warnings.push('Data is more than 24 hours old');
      } else if (dataAge > 6 * 60 * 60 * 1000) { // More than 6 hours
        validation.warnings.push('Data is more than 6 hours old');
      }

      // Price reasonableness checks
      if (commodityData.currentPrice > 1000000) {
        validation.warnings.push('Price seems unusually high');
      }

      if (commodityData.currentPrice < 0.01) {
        validation.warnings.push('Price seems unusually low');
      }

      // Set overall validity
      validation.isValid = validation.errors.length === 0;

    } catch (error) {
      validation.errors.push(`Validation error: ${(error as Error).message}`);
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Create a simple CommodityAnalysis from CommodityData
   * 
   * @param commodityData - Base commodity data
   * @param marketSentiment - Optional market sentiment
   * @returns CommodityAnalysis object
   */
  createBasicAnalysis(
    commodityData: CommodityData,
    marketSentiment?: string
  ): Omit<CommodityAnalysis, 'forecasts'> {
    return {
      commodity: commodityData,
      analysisDate: new Date().toISOString(),
      overallTrend: 'neutral', // Default trend, would need more data for accurate determination
      marketSentiment: marketSentiment || 'Data-driven analysis pending',
      riskFactors: [
        'Market volatility',
        'Data source reliability',
        'External economic factors'
      ]
    };
  }

  /**
   * Get service statistics
   * 
   * @returns Current service statistics
   */
  getServiceStats(): ServiceStats {
    return { ...this.stats };
  }

  /**
   * Reset service statistics
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    this.requestLog = [];
    this.logger.log('[YahooFinanceCommodityService] Statistics reset');
  }

  /**
   * Get supported symbols
   * 
   * @returns Array of supported Yahoo Finance symbols
   */
  getSupportedSymbols(): string[] {
    return Object.keys(this.parser.getSymbolMappings());
  }

  /**
   * Add custom symbol mapping
   * 
   * @param yahooSymbol - Yahoo Finance symbol
   * @param mapping - Symbol mapping configuration
   */
  addSymbolMapping(yahooSymbol: string, mapping: SymbolMapping): void {
    this.parser.addSymbolMapping(yahooSymbol, mapping);
    this.logger.log(`[YahooFinanceCommodityService] Added symbol mapping for ${yahooSymbol}`);
  }

  /**
   * Check if a symbol is supported
   * 
   * @param symbol - Yahoo Finance symbol to check
   * @returns True if symbol is supported
   */
  isSymbolSupported(symbol: string): boolean {
    const mappings = this.parser.getSymbolMappings();
    return symbol in mappings;
  }

  // Private helper methods

  /**
   * Initialize service statistics
   */
  private initializeStats(): ServiceStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      topSymbols: []
    };
  }

  /**
   * Update service statistics
   */
  private updateStats(symbol: string, success: boolean, responseTime: number): void {
    this.stats.totalRequests++;
    
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    this.stats.successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
      : 0;

    // Update average response time
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime;
    this.stats.averageResponseTime = totalTime / this.stats.totalRequests;

    // Log the request
    this.requestLog.push({
      symbol,
      timestamp: Date.now(),
      success,
      responseTime
    });

    // Maintain request log size (keep last 1000 requests)
    if (this.requestLog.length > 1000) {
      this.requestLog = this.requestLog.slice(-1000);
    }

    // Update top symbols
    this.updateTopSymbols(symbol);
  }

  /**
   * Update top symbols statistics
   */
  private updateTopSymbols(symbol: string): void {
    const existingEntry = this.stats.topSymbols.find(entry => entry.symbol === symbol);
    
    if (existingEntry) {
      existingEntry.count++;
    } else {
      this.stats.topSymbols.push({ symbol, count: 1 });
    }

    // Sort and keep top 10
    this.stats.topSymbols.sort((a, b) => b.count - a.count);
    this.stats.topSymbols = this.stats.topSymbols.slice(0, 10);
  }

  /**
   * Validate data age against maximum allowed age
   */
  private validateDataAge(commodityData: CommodityData, maxAge: number): void {
    const lastUpdated = new Date(commodityData.lastUpdated);
    const dataAge = Date.now() - lastUpdated.getTime();

    if (dataAge > maxAge) {
      throw new YahooFinanceCommodityServiceException(
        CommodityServiceError.VALIDATION_FAILED,
        `Data for ${commodityData.symbol} is too old (${Math.floor(dataAge / 1000)}s > ${Math.floor(maxAge / 1000)}s)`,
        commodityData.symbol,
        undefined,
        false
      );
    }
  }
}

/**
 * Singleton service instance
 */
let commodityServiceInstance: YahooFinanceCommodityService | null = null;

/**
 * Get singleton Yahoo Finance Commodity service instance
 * 
 * @returns YahooFinanceCommodityService instance
 */
export function getYahooFinanceCommodityService(): YahooFinanceCommodityService {
  if (!commodityServiceInstance) {
    commodityServiceInstance = new YahooFinanceCommodityService();
  }
  return commodityServiceInstance;
}

/**
 * Create new Yahoo Finance Commodity service instance
 * 
 * @param yahooService - Optional Yahoo Finance service instance
 * @param customSymbolMappings - Optional custom symbol mappings
 * @returns New YahooFinanceCommodityService instance
 */
export function createYahooFinanceCommodityService(
  yahooService?: YahooFinanceService,
  customSymbolMappings?: Record<string, SymbolMapping>
): YahooFinanceCommodityService {
  return new YahooFinanceCommodityService(yahooService, customSymbolMappings);
}

/**
 * Convenience functions for direct usage
 */

/**
 * Quick fetch function for single commodity
 */
export async function fetchCommodityData(
  symbol: string,
  options?: CommodityFetchOptions
): Promise<CommodityData> {
  const service = getYahooFinanceCommodityService();
  return service.getCommodityData(symbol, options);
}

/**
 * Quick fetch function for multiple commodities
 */
export async function fetchMultipleCommodityData(
  symbols: string[],
  options?: CommodityFetchOptions
): Promise<MultiCommodityResult> {
  const service = getYahooFinanceCommodityService();
  return service.getMultipleCommodityData(symbols, options);
}

/**
 * Default export
 */
export default YahooFinanceCommodityService;