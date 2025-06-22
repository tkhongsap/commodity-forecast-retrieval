/**
 * Yahoo Finance Response Parser
 * 
 * Converts Yahoo Finance API responses to the existing CommodityData interface format
 * for seamless integration with the current commodity forecasting system.
 * 
 * Features:
 * - Type-safe conversion from Yahoo Finance data to CommodityData
 * - Comprehensive error handling for parsing failures
 * - Data validation and integrity checks
 * - Source attribution for Yahoo Finance data
 * - Graceful handling of missing or invalid data
 * - Currency and unit mapping
 * - Timestamp conversion and formatting
 * 
 * @author Yahoo Finance Response Parser
 * @version 1.0.0
 */

import {
  CommodityData,
  SourceInfo,
  ValidationResult,
  ParsedPriceData
} from '../types/commodity';
import {
  YahooFinanceResponse,
  YahooFinancePriceData,
  ChartResult,
  YahooFinanceMeta
} from '../types/yahoo-finance';

/**
 * Parser error types for specific conversion operations
 */
export enum YahooFinanceParserError {
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  MISSING_REQUIRED_DATA = 'MISSING_REQUIRED_DATA',
  PRICE_PARSING_FAILED = 'PRICE_PARSING_FAILED',
  SYMBOL_MAPPING_FAILED = 'SYMBOL_MAPPING_FAILED',
  CURRENCY_CONVERSION_FAILED = 'CURRENCY_CONVERSION_FAILED',
  TIMESTAMP_PARSING_FAILED = 'TIMESTAMP_PARSING_FAILED',
  DATA_VALIDATION_FAILED = 'DATA_VALIDATION_FAILED'
}

/**
 * Parser-specific error class
 */
export class YahooFinanceParserException extends Error {
  public readonly errorType: YahooFinanceParserError;
  public readonly symbol: string | undefined;
  public readonly originalData: any;

  constructor(
    errorType: YahooFinanceParserError,
    message: string,
    symbol?: string,
    originalData?: any
  ) {
    super(message);
    this.name = 'YahooFinanceParserException';
    this.errorType = errorType;
    this.symbol = symbol;
    this.originalData = originalData;
  }
}

/**
 * Symbol mapping configuration for converting Yahoo Finance symbols
 * to standardized commodity names and metadata
 */
export interface SymbolMapping {
  yahooSymbol: string;
  commodityName: string;
  unit: string;
  currency: string;
  type: 'commodity';
}

/**
 * Parser options for customizing conversion behavior
 */
export interface ParserOptions {
  /** Validate data integrity during parsing */
  validateData?: boolean;
  /** Include extended metadata in source attribution */
  includeExtendedMetadata?: boolean;
  /** Apply strict validation rules */
  strictValidation?: boolean;
  /** Custom source attribution URL */
  sourceUrl?: string;
  /** Override currency mapping */
  currencyOverride?: string;
  /** Override unit mapping */
  unitOverride?: string;
}

/**
 * Default symbol mappings for common commodities
 */
export const DEFAULT_SYMBOL_MAPPINGS: Record<string, SymbolMapping> = {
  'CL=F': {
    yahooSymbol: 'CL=F',
    commodityName: 'Crude Oil (WTI)',
    unit: 'USD per barrel',
    currency: 'USD',
    type: 'commodity'
  },
  'BZ=F': {
    yahooSymbol: 'BZ=F',
    commodityName: 'Crude Oil (Brent)',
    unit: 'USD per barrel',
    currency: 'USD',
    type: 'commodity'
  },
  'NG=F': {
    yahooSymbol: 'NG=F',
    commodityName: 'Natural Gas',
    unit: 'USD per MMBtu',
    currency: 'USD',
    type: 'commodity'
  },
  'GC=F': {
    yahooSymbol: 'GC=F',
    commodityName: 'Gold',
    unit: 'USD per troy ounce',
    currency: 'USD',
    type: 'commodity'
  },
  'SI=F': {
    yahooSymbol: 'SI=F',
    commodityName: 'Silver',
    unit: 'USD per troy ounce',
    currency: 'USD',
    type: 'commodity'
  },
  'HG=F': {
    yahooSymbol: 'HG=F',
    commodityName: 'Copper',
    unit: 'USD per pound',
    currency: 'USD',
    type: 'commodity'
  }
};

/**
 * Main parser class for converting Yahoo Finance data to CommodityData format
 */
export class YahooFinanceParser {
  private symbolMappings: Record<string, SymbolMapping>;
  private logger: Console;

  constructor(customMappings?: Record<string, SymbolMapping>) {
    this.symbolMappings = { ...DEFAULT_SYMBOL_MAPPINGS, ...customMappings };
    this.logger = console;
  }

  /**
   * Convert Yahoo Finance response to CommodityData format
   * 
   * @param response - Yahoo Finance API response
   * @param options - Parser options for customization
   * @returns Promise resolving to CommodityData object
   * @throws YahooFinanceParserException on parsing errors
   */
  async parseToCommodityData(
    response: YahooFinanceResponse,
    options: ParserOptions = {}
  ): Promise<CommodityData> {
    try {
      this.logger.log('[YahooFinanceParser] Starting conversion to CommodityData format');

      // Validate response structure
      if (options.validateData !== false) {
        this.validateResponseStructure(response);
      }

      // Extract chart result
      const chartResult = this.extractChartResult(response);
      const meta = chartResult.meta;

      // Get symbol mapping
      const symbolMapping = this.getSymbolMapping(meta.symbol, options);

      // Parse price data
      const priceData = this.parsePriceData(chartResult, symbolMapping, options);

      // Create source attribution
      const sourceInfo = this.createSourceAttribution(meta, options);

      // Build CommodityData object
      const commodityData: CommodityData = {
        symbol: meta.symbol,
        name: symbolMapping.commodityName,
        type: 'commodity',
        unit: options.unitOverride || symbolMapping.unit,
        currentPrice: priceData.price || 0,
        currency: options.currencyOverride || symbolMapping.currency,
        lastUpdated: this.convertTimestamp(meta.regularMarketTime),
        sources: [sourceInfo]
      };

      // Final validation
      if (options.strictValidation) {
        this.validateCommodityData(commodityData);
      }

      this.logger.log(`[YahooFinanceParser] Successfully converted ${meta.symbol} to CommodityData format`);
      return commodityData;

    } catch (error) {
      if (error instanceof YahooFinanceParserException) {
        throw error;
      }

      this.logger.error('[YahooFinanceParser] Error during conversion:', error);
      throw new YahooFinanceParserException(
        YahooFinanceParserError.INVALID_RESPONSE,
        `Failed to parse Yahoo Finance response: ${(error as Error).message}`,
        undefined,
        response
      );
    }
  }

  /**
   * Convert YahooFinancePriceData to CommodityData format
   * 
   * @param priceData - Yahoo Finance price data object
   * @param options - Parser options for customization
   * @returns CommodityData object
   */
  parseFromPriceData(
    priceData: YahooFinancePriceData,
    options: ParserOptions = {}
  ): CommodityData {
    try {
      this.logger.log(`[YahooFinanceParser] Converting YahooFinancePriceData for ${priceData.symbol}`);

      // Get symbol mapping
      const symbolMapping = this.getSymbolMapping(priceData.symbol, options);

      // Create source attribution
      const sourceInfo: SourceInfo = {
        name: 'Yahoo Finance',
        url: options.sourceUrl || `https://finance.yahoo.com/quote/${priceData.symbol}`,
        date: new Date().toISOString(),
        reliability: 'high'
      };

      // Build CommodityData object
      const commodityData: CommodityData = {
        symbol: priceData.symbol,
        name: symbolMapping.commodityName,
        type: 'commodity',
        unit: options.unitOverride || symbolMapping.unit,
        currentPrice: priceData.currentPrice,
        currency: options.currencyOverride || priceData.currency,
        lastUpdated: priceData.lastUpdated,
        sources: [sourceInfo]
      };

      // Validation
      if (options.strictValidation) {
        this.validateCommodityData(commodityData);
      }

      this.logger.log(`[YahooFinanceParser] Successfully converted ${priceData.symbol} from YahooFinancePriceData`);
      return commodityData;

    } catch (error) {
      this.logger.error('[YahooFinanceParser] Error converting from YahooFinancePriceData:', error);
      throw new YahooFinanceParserException(
        YahooFinanceParserError.DATA_VALIDATION_FAILED,
        `Failed to convert YahooFinancePriceData: ${(error as Error).message}`,
        priceData.symbol,
        priceData
      );
    }
  }

  /**
   * Parse multiple Yahoo Finance responses to CommodityData array
   * 
   * @param responses - Array of Yahoo Finance responses
   * @param options - Parser options for customization
   * @returns Promise resolving to array of CommodityData objects
   */
  async parseMultipleToCommodityData(
    responses: YahooFinanceResponse[],
    options: ParserOptions = {}
  ): Promise<CommodityData[]> {
    const results: CommodityData[] = [];
    const errors: Array<{ symbol: string; error: Error }> = [];

    for (const response of responses) {
      try {
        const commodityData = await this.parseToCommodityData(response, options);
        results.push(commodityData);
      } catch (error) {
        const symbol = this.extractSymbolFromResponse(response);
        errors.push({ symbol: symbol || 'unknown', error: error as Error });
        this.logger.warn(`[YahooFinanceParser] Failed to parse response for symbol ${symbol}:`, error);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`[YahooFinanceParser] Completed with ${errors.length} parsing errors out of ${responses.length} responses`);
    }

    return results;
  }

  /**
   * Validate Yahoo Finance response data and return parsed price information
   * 
   * @param response - Yahoo Finance response
   * @returns ParsedPriceData with validation results
   */
  validateAndParsePriceData(response: YahooFinanceResponse): ParsedPriceData {
    try {
      const chartResult = this.extractChartResult(response);
      const meta = chartResult.meta;
      const symbolMapping = this.getSymbolMapping(meta.symbol);

      // Extract price with confidence scoring
      let price: number | null = null;
      let confidence = 0;

      // Try metadata first (highest confidence)
      if (meta.regularMarketPrice && meta.regularMarketPrice > 0) {
        price = meta.regularMarketPrice;
        confidence = 0.95;
      } else {
        // Fall back to quote data (lower confidence)
        const quote = chartResult.indicators?.quote?.[0];
        if (quote?.close && quote.close.length > 0) {
          price = this.getLatestNonNull(quote.close);
          confidence = price !== null ? 0.8 : 0;
        }
      }

      // Check data freshness only if we have a valid price
      if (price !== null && price > 0) {
        const dataAge = Date.now() - (meta.regularMarketTime * 1000);
        if (dataAge > 30 * 60 * 1000) { // More than 30 minutes old
          confidence *= 0.7;
        }
      } else {
        confidence = 0;
      }

      return {
        price,
        currency: symbolMapping.currency,
        unit: symbolMapping.unit,
        source: 'Yahoo Finance',
        confidence: Math.max(0, Math.min(1, confidence))
      };

    } catch (error) {
      this.logger.error('[YahooFinanceParser] Error validating and parsing price data:', error);
      return {
        price: null,
        currency: 'USD',
        unit: 'unknown',
        source: 'Yahoo Finance',
        confidence: 0
      };
    }
  }

  /**
   * Add custom symbol mapping
   * 
   * @param yahooSymbol - Yahoo Finance symbol
   * @param mapping - Symbol mapping configuration
   */
  addSymbolMapping(yahooSymbol: string, mapping: SymbolMapping): void {
    this.symbolMappings[yahooSymbol] = mapping;
    this.logger.log(`[YahooFinanceParser] Added custom symbol mapping for ${yahooSymbol}`);
  }

  /**
   * Get available symbol mappings
   * 
   * @returns Record of all configured symbol mappings
   */
  getSymbolMappings(): Record<string, SymbolMapping> {
    return { ...this.symbolMappings };
  }

  // Private helper methods

  /**
   * Validate Yahoo Finance response structure
   */
  private validateResponseStructure(response: YahooFinanceResponse): void {
    if (!response) {
      throw new YahooFinanceParserException(
        YahooFinanceParserError.INVALID_RESPONSE,
        'Response is null or undefined'
      );
    }

    if (!response.chart) {
      throw new YahooFinanceParserException(
        YahooFinanceParserError.INVALID_RESPONSE,
        'Response missing chart data'
      );
    }

    if (response.chart.error) {
      throw new YahooFinanceParserException(
        YahooFinanceParserError.INVALID_RESPONSE,
        `Yahoo Finance API error: ${response.chart.error.description}`,
        undefined,
        response.chart.error
      );
    }

    if (!response.chart.result || response.chart.result.length === 0) {
      throw new YahooFinanceParserException(
        YahooFinanceParserError.MISSING_REQUIRED_DATA,
        'No chart results in response'
      );
    }
  }

  /**
   * Extract chart result from response
   */
  private extractChartResult(response: YahooFinanceResponse): ChartResult {
    const result = response.chart.result[0];
    if (!result) {
      throw new YahooFinanceParserException(
        YahooFinanceParserError.MISSING_REQUIRED_DATA,
        'No chart result data available'
      );
    }

    if (!result.meta) {
      throw new YahooFinanceParserException(
        YahooFinanceParserError.MISSING_REQUIRED_DATA,
        'Missing metadata in chart result'
      );
    }

    return result;
  }

  /**
   * Get symbol mapping for a Yahoo Finance symbol
   */
  private getSymbolMapping(symbol: string, _options?: ParserOptions): SymbolMapping {
    const mapping = this.symbolMappings[symbol];
    if (!mapping) {
      // Create default mapping for unknown symbols
      this.logger.warn(`[YahooFinanceParser] No mapping found for symbol ${symbol}, using default`);
      return {
        yahooSymbol: symbol,
        commodityName: `Commodity (${symbol})`,
        unit: 'USD per unit',
        currency: 'USD',
        type: 'commodity'
      };
    }

    return mapping;
  }

  /**
   * Parse price data from chart result
   */
  private parsePriceData(
    chartResult: ChartResult,
    symbolMapping: SymbolMapping,
    _options: ParserOptions
  ): ParsedPriceData {
    const meta = chartResult.meta;
    let price: number | null = null;
    let confidence = 0;

    try {
      // Try to get price from metadata first
      if (meta.regularMarketPrice && meta.regularMarketPrice > 0) {
        price = meta.regularMarketPrice;
        confidence = 0.95;
      } else {
        // Fall back to quote data
        const quote = chartResult.indicators?.quote?.[0];
        if (quote?.close && quote.close.length > 0) {
          price = this.getLatestNonNull(quote.close);
          confidence = 0.8;
        }
      }

      if (price === null || price <= 0) {
        throw new YahooFinanceParserException(
          YahooFinanceParserError.PRICE_PARSING_FAILED,
          `Could not extract valid price for symbol ${meta.symbol}`,
          meta.symbol
        );
      }

      return {
        price,
        currency: symbolMapping.currency,
        unit: symbolMapping.unit,
        source: 'Yahoo Finance',
        confidence
      };

    } catch (error) {
      if (error instanceof YahooFinanceParserException) {
        throw error;
      }

      throw new YahooFinanceParserException(
        YahooFinanceParserError.PRICE_PARSING_FAILED,
        `Failed to parse price data: ${(error as Error).message}`,
        meta.symbol,
        chartResult
      );
    }
  }

  /**
   * Create source attribution information
   */
  private createSourceAttribution(meta: YahooFinanceMeta, options: ParserOptions): SourceInfo {
    const sourceInfo: SourceInfo = {
      name: 'Yahoo Finance',
      url: options.sourceUrl || `https://finance.yahoo.com/quote/${meta.symbol}`,
      date: new Date().toISOString(),
      reliability: 'high'
    };

    // Add extended metadata if requested
    if (options.includeExtendedMetadata) {
      (sourceInfo as any).metadata = {
        exchange: meta.exchangeName,
        instrumentType: meta.instrumentType,
        dataTimestamp: meta.regularMarketTime,
        timezone: meta.timezone
      };
    }

    return sourceInfo;
  }

  /**
   * Convert Unix timestamp to ISO string
   */
  private convertTimestamp(timestamp: number): string {
    try {
      if (!timestamp || timestamp <= 0) {
        throw new Error('Invalid timestamp');
      }

      return new Date(timestamp * 1000).toISOString();
    } catch (error) {
      this.logger.warn(`[YahooFinanceParser] Error converting timestamp ${timestamp}:`, error);
      return new Date().toISOString(); // Fall back to current time
    }
  }

  /**
   * Validate final CommodityData object
   */
  private validateCommodityData(commodityData: CommodityData): ValidationResult {
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check required fields
    if (!commodityData.symbol) {
      validation.errors.push('Missing symbol');
      validation.isValid = false;
    }

    if (!commodityData.name) {
      validation.errors.push('Missing name');
      validation.isValid = false;
    }

    if (commodityData.currentPrice <= 0) {
      validation.errors.push('Invalid current price');
      validation.isValid = false;
    }

    if (!commodityData.currency) {
      validation.errors.push('Missing currency');
      validation.isValid = false;
    }

    if (!commodityData.unit) {
      validation.errors.push('Missing unit');
      validation.isValid = false;
    }

    if (!commodityData.lastUpdated) {
      validation.errors.push('Missing lastUpdated timestamp');
      validation.isValid = false;
    }

    if (!commodityData.sources || commodityData.sources.length === 0) {
      validation.errors.push('Missing source information');
      validation.isValid = false;
    }

    // Check data quality
    if (commodityData.currentPrice > 100000) {
      validation.warnings.push('Price seems unusually high');
    }

    const lastUpdated = new Date(commodityData.lastUpdated);
    const dataAge = Date.now() - lastUpdated.getTime();
    if (dataAge > 24 * 60 * 60 * 1000) { // More than 24 hours old
      validation.warnings.push('Data is more than 24 hours old');
    }

    if (!validation.isValid) {
      throw new YahooFinanceParserException(
        YahooFinanceParserError.DATA_VALIDATION_FAILED,
        `CommodityData validation failed: ${validation.errors.join(', ')}`,
        commodityData.symbol,
        commodityData
      );
    }

    return validation;
  }

  /**
   * Extract symbol from response for error reporting
   */
  private extractSymbolFromResponse(response: YahooFinanceResponse): string | null {
    try {
      return response?.chart?.result?.[0]?.meta?.symbol || null;
    } catch {
      return null;
    }
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
}

/**
 * Convenience functions for direct usage
 */

/**
 * Create a parser instance with default configuration
 */
export function createYahooFinanceParser(customMappings?: Record<string, SymbolMapping>): YahooFinanceParser {
  return new YahooFinanceParser(customMappings);
}

/**
 * Quick parse function for single Yahoo Finance response
 */
export async function parseYahooFinanceToCommodityData(
  response: YahooFinanceResponse,
  options?: ParserOptions
): Promise<CommodityData> {
  const parser = createYahooFinanceParser();
  return parser.parseToCommodityData(response, options);
}

/**
 * Quick parse function for YahooFinancePriceData
 */
export function parseYahooFinancePriceDataToCommodityData(
  priceData: YahooFinancePriceData,
  options?: ParserOptions
): CommodityData {
  const parser = createYahooFinanceParser();
  return parser.parseFromPriceData(priceData, options);
}

/**
 * Default parser instance for module-level usage
 */
export const defaultParser = createYahooFinanceParser();

/**
 * Export for testing and advanced usage
 */
export {
  YahooFinanceParser as Parser
};