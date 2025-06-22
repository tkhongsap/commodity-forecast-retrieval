/**
 * Data Validation Module for Yahoo Finance Integration
 * 
 * Comprehensive data validation system that handles invalid responses, malformed data,
 * and ensures data integrity across all Yahoo Finance integration components. This module
 * provides robust validation for API responses, data transformation, and error recovery.
 * 
 * Features:
 * - Response structure validation
 * - Data type and format validation
 * - Business rule validation
 * - Data quality assessment
 * - Validation error recovery
 * - Schema validation
 * - Data sanitization and normalization
 * - Performance validation monitoring
 * 
 * @author Yahoo Finance Data Validation Module
 * @version 1.0.0
 */

import { 
  YahooFinanceResponse,
  YahooFinanceMeta,
  QuoteData,
  ChartResult,
  YahooFinancePriceData,
  HistoricalPricePoint,
  YahooFinanceValidation
} from '../types/yahoo-finance';
import { 
  YahooFinanceError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  createErrorContext,
  ErrorContext
} from './error-handler';
import { VALIDATION_RULES, COMMODITY_SYMBOLS } from '../config/yahoo-finance';

/**
 * Validation severity levels
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Data validation result with detailed information
 */
export interface DataValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validation errors that prevent processing */
  errors: ValidationIssue[];
  /** Validation warnings that don't prevent processing */
  warnings: ValidationIssue[];
  /** Informational validation notes */
  info: ValidationIssue[];
  /** Overall data quality score (0-1) */
  qualityScore: number;
  /** Validation context */
  context: ValidationContext;
  /** Suggested fixes for issues */
  suggestedFixes: string[];
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  /** Issue severity */
  severity: ValidationSeverity;
  /** Issue code for categorization */
  code: string;
  /** Human-readable message */
  message: string;
  /** Data field that caused the issue */
  field?: string;
  /** Expected value or format */
  expected?: any;
  /** Actual value found */
  actual?: any;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Validation context information
 */
export interface ValidationContext {
  /** Symbol being validated */
  symbol?: string;
  /** Operation that triggered validation */
  operation: string;
  /** Component performing validation */
  component: string;
  /** Validation timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Schema definition for validation
 */
export interface ValidationSchema {
  /** Required fields */
  required: string[];
  /** Optional fields */
  optional?: string[];
  /** Field type definitions */
  types: Record<string, string>;
  /** Custom validation rules */
  custom?: Record<string, (value: any) => boolean>;
  /** Nested schema definitions */
  nested?: Record<string, ValidationSchema>;
}

/**
 * Data quality metrics
 */
export interface DataQualityMetrics {
  /** Completeness score (0-1) */
  completeness: number;
  /** Accuracy score (0-1) */
  accuracy: number;
  /** Consistency score (0-1) */
  consistency: number;
  /** Timeliness score (0-1) */
  timeliness: number;
  /** Overall quality score (0-1) */
  overall: number;
  /** Issues found */
  issueCount: {
    errors: number;
    warnings: number;
    info: number;
  };
}

/**
 * Yahoo Finance Response Validator
 */
export class YahooFinanceResponseValidator {
  private static readonly RESPONSE_SCHEMA: ValidationSchema = {
    required: ['chart'],
    types: {
      chart: 'object'
    },
    nested: {
      chart: {
        required: ['result'],
        optional: ['error'],
        types: {
          result: 'array',
          error: 'object'
        }
      }
    }
  };

  private static readonly CHART_RESULT_SCHEMA: ValidationSchema = {
    required: ['meta', 'timestamp', 'indicators'],
    types: {
      meta: 'object',
      timestamp: 'array',
      indicators: 'object'
    },
    nested: {
      meta: {
        required: ['symbol', 'currency', 'exchangeName', 'regularMarketTime'],
        optional: ['regularMarketPrice', 'regularMarketVolume'],
        types: {
          symbol: 'string',
          currency: 'string',
          exchangeName: 'string',
          regularMarketTime: 'number'
        }
      },
      indicators: {
        required: ['quote'],
        optional: ['adjclose'],
        types: {
          quote: 'array',
          adjclose: 'array'
        }
      }
    }
  };

  /**
   * Validate complete Yahoo Finance response
   */
  static validateResponse(
    response: any,
    context: ValidationContext
  ): DataValidationResult {
    const result: DataValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      info: [],
      qualityScore: 1.0,
      context,
      suggestedFixes: []
    };

    try {
      // Basic structure validation
      this.validateStructure(response, this.RESPONSE_SCHEMA, result, 'response');

      // Validate chart data if present
      if (response?.chart) {
        this.validateChartData(response.chart, result, context);
      }

      // Calculate overall quality score
      result.qualityScore = this.calculateQualityScore(result);
      result.isValid = result.errors.length === 0;

      // Generate suggested fixes
      result.suggestedFixes = this.generateSuggestedFixes(result);

    } catch (error) {
      result.errors.push({
        severity: ValidationSeverity.ERROR,
        code: 'VALIDATION_EXCEPTION',
        message: `Validation failed: ${(error as Error).message}`,
        suggestion: 'Check data format and try again'
      });
      result.isValid = false;
      result.qualityScore = 0;
    }

    return result;
  }

  /**
   * Validate chart data structure
   */
  private static validateChartData(
    chartData: any,
    result: DataValidationResult,
    context: ValidationContext
  ): void {
    // Check for API errors
    if (chartData.error) {
      result.errors.push({
        severity: ValidationSeverity.ERROR,
        code: 'API_ERROR',
        message: `API returned error: ${chartData.error.description}`,
        field: 'chart.error',
        actual: chartData.error,
        suggestion: 'Check symbol validity and API status'
      });
      return;
    }

    // Validate results array
    if (!Array.isArray(chartData.result)) {
      result.errors.push({
        severity: ValidationSeverity.ERROR,
        code: 'INVALID_RESULTS_TYPE',
        message: 'Chart results must be an array',
        field: 'chart.result',
        expected: 'array',
        actual: typeof chartData.result,
        suggestion: 'Verify API response format'
      });
      return;
    }

    if (chartData.result.length === 0) {
      result.errors.push({
        severity: ValidationSeverity.ERROR,
        code: 'EMPTY_RESULTS',
        message: 'No chart data available',
        field: 'chart.result',
        suggestion: 'Check if symbol exists and market is open'
      });
      return;
    }

    // Validate each chart result
    chartData.result.forEach((chartResult: any, index: number) => {
      this.validateChartResult(chartResult, result, context, index);
    });
  }

  /**
   * Validate individual chart result
   */
  private static validateChartResult(
    chartResult: any,
    result: DataValidationResult,
    context: ValidationContext,
    index: number
  ): void {
    const fieldPrefix = `chart.result[${index}]`;

    // Structure validation
    this.validateStructure(chartResult, this.CHART_RESULT_SCHEMA, result, fieldPrefix);

    // Validate metadata
    if (chartResult.meta) {
      this.validateMetadata(chartResult.meta, result, context, fieldPrefix);
    }

    // Validate timestamp array
    if (chartResult.timestamp) {
      this.validateTimestamps(chartResult.timestamp, result, fieldPrefix);
    }

    // Validate indicators
    if (chartResult.indicators) {
      this.validateIndicators(chartResult.indicators, result, fieldPrefix, chartResult.timestamp?.length);
    }

    // Cross-validation between different data arrays
    this.validateDataConsistency(chartResult, result, fieldPrefix);
  }

  /**
   * Validate metadata information
   */
  private static validateMetadata(
    meta: YahooFinanceMeta,
    result: DataValidationResult,
    context: ValidationContext,
    fieldPrefix: string
  ): void {
    // Validate symbol format
    if (meta.symbol && typeof meta.symbol === 'string') {
      if (!this.isValidSymbolFormat(meta.symbol)) {
        result.warnings.push({
          severity: ValidationSeverity.WARNING,
          code: 'INVALID_SYMBOL_FORMAT',
          message: `Symbol format may be incorrect: ${meta.symbol}`,
          field: `${fieldPrefix}.meta.symbol`,
          actual: meta.symbol,
          suggestion: 'Verify symbol format (e.g., CL=F for futures)'
        });
      }
    }

    // Validate price values
    if (typeof meta.regularMarketPrice === 'number') {
      if (meta.regularMarketPrice <= 0) {
        result.errors.push({
          severity: ValidationSeverity.ERROR,
          code: 'INVALID_PRICE',
          message: 'Regular market price must be positive',
          field: `${fieldPrefix}.meta.regularMarketPrice`,
          actual: meta.regularMarketPrice,
          suggestion: 'Check for data corruption or API issues'
        });
      }

      // Validate price ranges for known commodities
      this.validatePriceRange(meta.symbol, meta.regularMarketPrice, result, fieldPrefix);
    }

    // Validate timestamp
    if (typeof meta.regularMarketTime === 'number') {
      const marketTime = new Date(meta.regularMarketTime * 1000);
      const now = new Date();
      const timeDiff = now.getTime() - marketTime.getTime();

      if (timeDiff < 0) {
        result.errors.push({
          severity: ValidationSeverity.ERROR,
          code: 'FUTURE_TIMESTAMP',
          message: 'Market time cannot be in the future',
          field: `${fieldPrefix}.meta.regularMarketTime`,
          actual: marketTime.toISOString(),
          suggestion: 'Check system clock and data source'
        });
      } else if (timeDiff > 7 * 24 * 60 * 60 * 1000) { // More than 7 days old
        result.warnings.push({
          severity: ValidationSeverity.WARNING,
          code: 'STALE_DATA',
          message: `Data is more than 7 days old: ${Math.floor(timeDiff / (24 * 60 * 60 * 1000))} days`,
          field: `${fieldPrefix}.meta.regularMarketTime`,
          actual: marketTime.toISOString(),
          suggestion: 'Consider refreshing data or using cached data flag'
        });
      }
    }

    // Validate currency
    if (meta.currency && typeof meta.currency === 'string') {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];
      if (!validCurrencies.includes(meta.currency.toUpperCase())) {
        result.info.push({
          severity: ValidationSeverity.INFO,
          code: 'UNUSUAL_CURRENCY',
          message: `Unusual currency detected: ${meta.currency}`,
          field: `${fieldPrefix}.meta.currency`,
          actual: meta.currency,
          suggestion: 'Verify currency is correct for this instrument'
        });
      }
    }
  }

  /**
   * Validate timestamp array
   */
  private static validateTimestamps(
    timestamps: number[],
    result: DataValidationResult,
    fieldPrefix: string
  ): void {
    if (!Array.isArray(timestamps)) {
      result.errors.push({
        severity: ValidationSeverity.ERROR,
        code: 'INVALID_TIMESTAMPS_TYPE',
        message: 'Timestamps must be an array',
        field: `${fieldPrefix}.timestamp`,
        expected: 'array',
        actual: typeof timestamps,
        suggestion: 'Check API response format'
      });
      return;
    }

    if (timestamps.length === 0) {
      result.errors.push({
        severity: ValidationSeverity.ERROR,
        code: 'EMPTY_TIMESTAMPS',
        message: 'Timestamp array is empty',
        field: `${fieldPrefix}.timestamp`,
        suggestion: 'Check if data is available for the requested time range'
      });
      return;
    }

    // Check for valid timestamps and ordering
    let prevTimestamp = 0;
    timestamps.forEach((timestamp, index) => {
      if (typeof timestamp !== 'number' || timestamp <= 0) {
        result.errors.push({
          severity: ValidationSeverity.ERROR,
          code: 'INVALID_TIMESTAMP',
          message: `Invalid timestamp at index ${index}`,
          field: `${fieldPrefix}.timestamp[${index}]`,
          actual: timestamp,
          suggestion: 'Check for data corruption'
        });
      } else if (timestamp < prevTimestamp) {
        result.warnings.push({
          severity: ValidationSeverity.WARNING,
          code: 'UNORDERED_TIMESTAMPS',
          message: `Timestamps are not in ascending order at index ${index}`,
          field: `${fieldPrefix}.timestamp[${index}]`,
          suggestion: 'Data may need sorting'
        });
      }
      prevTimestamp = timestamp;
    });
  }

  /**
   * Validate indicators data
   */
  private static validateIndicators(
    indicators: any,
    result: DataValidationResult,
    fieldPrefix: string,
    timestampLength: number = 0
  ): void {
    if (!indicators.quote || !Array.isArray(indicators.quote)) {
      result.errors.push({
        severity: ValidationSeverity.ERROR,
        code: 'MISSING_QUOTE_DATA',
        message: 'Quote indicators are missing or invalid',
        field: `${fieldPrefix}.indicators.quote`,
        suggestion: 'Check API response format'
      });
      return;
    }

    // Validate each quote data set
    indicators.quote.forEach((quote: QuoteData, index: number) => {
      this.validateQuoteData(quote, result, `${fieldPrefix}.indicators.quote[${index}]`, timestampLength);
    });

    // Validate adjusted close if present
    if (indicators.adjclose && Array.isArray(indicators.adjclose)) {
      indicators.adjclose.forEach((adjClose: any, index: number) => {
        this.validateAdjCloseData(adjClose, result, `${fieldPrefix}.indicators.adjclose[${index}]`, timestampLength);
      });
    }
  }

  /**
   * Validate quote data (OHLCV)
   */
  private static validateQuoteData(
    quote: QuoteData,
    result: DataValidationResult,
    fieldPrefix: string,
    timestampLength: number
  ): void {
    const requiredFields = ['open', 'high', 'low', 'close', 'volume'];
    
    requiredFields.forEach(field => {
      if (!(field in quote)) {
        result.errors.push({
          severity: ValidationSeverity.ERROR,
          code: 'MISSING_QUOTE_FIELD',
          message: `Missing ${field} data in quote`,
          field: `${fieldPrefix}.${field}`,
          suggestion: 'Check API response completeness'
        });
        return;
      }

      const data = (quote as any)[field];
      if (!Array.isArray(data)) {
        result.errors.push({
          severity: ValidationSeverity.ERROR,
          code: 'INVALID_QUOTE_FIELD_TYPE',
          message: `${field} must be an array`,
          field: `${fieldPrefix}.${field}`,
          expected: 'array',
          actual: typeof data,
          suggestion: 'Check data format'
        });
        return;
      }

      // Validate array length consistency
      if (timestampLength > 0 && data.length !== timestampLength) {
        result.warnings.push({
          severity: ValidationSeverity.WARNING,
          code: 'ARRAY_LENGTH_MISMATCH',
          message: `${field} array length (${data.length}) doesn't match timestamp length (${timestampLength})`,
          field: `${fieldPrefix}.${field}`,
          suggestion: 'Check for data synchronization issues'
        });
      }

      // Validate individual values
      this.validatePriceArray(data, field, result, fieldPrefix);
    });

    // Validate OHLC relationships
    this.validateOHLCRelationships(quote, result, fieldPrefix);
  }

  /**
   * Validate price array values
   */
  private static validatePriceArray(
    priceArray: (number | null)[],
    fieldName: string,
    result: DataValidationResult,
    fieldPrefix: string
  ): void {
    let nullCount = 0;
    let negativeCount = 0;
    let zeroCount = 0;

    priceArray.forEach((price, index) => {
      if (price === null) {
        nullCount++;
      } else if (typeof price !== 'number') {
        result.errors.push({
          severity: ValidationSeverity.ERROR,
          code: 'INVALID_PRICE_TYPE',
          message: `Invalid price type at ${fieldName}[${index}]`,
          field: `${fieldPrefix}.${fieldName}[${index}]`,
          expected: 'number or null',
          actual: typeof price,
          suggestion: 'Check data parsing'
        });
      } else if (price < 0) {
        negativeCount++;
        result.warnings.push({
          severity: ValidationSeverity.WARNING,
          code: 'NEGATIVE_PRICE',
          message: `Negative price at ${fieldName}[${index}]: ${price}`,
          field: `${fieldPrefix}.${fieldName}[${index}]`,
          actual: price,
          suggestion: 'Check for data errors or special situations'
        });
      } else if (price === 0 && fieldName !== 'volume') {
        zeroCount++;
        result.warnings.push({
          severity: ValidationSeverity.WARNING,
          code: 'ZERO_PRICE',
          message: `Zero price at ${fieldName}[${index}]`,
          field: `${fieldPrefix}.${fieldName}[${index}]`,
          suggestion: 'Check for trading halts or data issues'
        });
      }
    });

    // Report aggregate statistics
    const totalCount = priceArray.length;
    if (nullCount > totalCount * 0.5) {
      result.warnings.push({
        severity: ValidationSeverity.WARNING,
        code: 'EXCESSIVE_NULL_VALUES',
        message: `High percentage of null values in ${fieldName}: ${(nullCount / totalCount * 100).toFixed(1)}%`,
        field: `${fieldPrefix}.${fieldName}`,
        suggestion: 'Check data quality and availability'
      });
    }
  }

  /**
   * Validate OHLC relationships
   */
  private static validateOHLCRelationships(
    quote: QuoteData,
    result: DataValidationResult,
    fieldPrefix: string
  ): void {
    const { open, high, low, close } = quote;
    
    if (!open || !high || !low || !close) return;

    const minLength = Math.min(open.length, high.length, low.length, close.length);

    for (let i = 0; i < minLength; i++) {
      const o = open[i];
      const h = high[i];
      const l = low[i];
      const c = close[i];

      // Skip null values
      if (o === null || h === null || l === null || c === null) continue;

      // High should be >= all other values
      if (h < o || h < l || h < c) {
        result.warnings.push({
          severity: ValidationSeverity.WARNING,
          code: 'INVALID_OHLC_RELATIONSHIP',
          message: `High price is lower than other OHLC values at index ${i}`,
          field: `${fieldPrefix}.high[${i}]`,
          suggestion: 'Check for data errors or extreme market conditions'
        });
      }

      // Low should be <= all other values
      if (l > o || l > h || l > c) {
        result.warnings.push({
          severity: ValidationSeverity.WARNING,
          code: 'INVALID_OHLC_RELATIONSHIP',
          message: `Low price is higher than other OHLC values at index ${i}`,
          field: `${fieldPrefix}.low[${i}]`,
          suggestion: 'Check for data errors or extreme market conditions'
        });
      }
    }
  }

  /**
   * Validate adjusted close data
   */
  private static validateAdjCloseData(
    adjClose: any,
    result: DataValidationResult,
    fieldPrefix: string,
    timestampLength: number
  ): void {
    if (!adjClose.adjclose || !Array.isArray(adjClose.adjclose)) {
      result.warnings.push({
        severity: ValidationSeverity.WARNING,
        code: 'INVALID_ADJCLOSE_FORMAT',
        message: 'Adjusted close data format is invalid',
        field: `${fieldPrefix}.adjclose`,
        suggestion: 'Check if adjusted close data is available'
      });
      return;
    }

    // Validate array length
    if (timestampLength > 0 && adjClose.adjclose.length !== timestampLength) {
      result.warnings.push({
        severity: ValidationSeverity.WARNING,
        code: 'ADJCLOSE_LENGTH_MISMATCH',
        message: `Adjusted close array length doesn't match timestamp length`,
        field: `${fieldPrefix}.adjclose`,
        suggestion: 'Check data synchronization'
      });
    }

    // Validate values
    this.validatePriceArray(adjClose.adjclose, 'adjclose', result, fieldPrefix);
  }

  /**
   * Validate data consistency across different arrays
   */
  private static validateDataConsistency(
    chartResult: ChartResult,
    result: DataValidationResult,
    fieldPrefix: string
  ): void {
    const timestamps = chartResult.timestamp;
    const quote = chartResult.indicators?.quote?.[0];

    if (!timestamps || !quote) return;

    // Check if all data arrays have consistent lengths
    const timestampLength = timestamps.length;
    const dataArrays = ['open', 'high', 'low', 'close', 'volume'];
    
    dataArrays.forEach(field => {
      const data = (quote as any)[field];
      if (Array.isArray(data) && data.length !== timestampLength) {
        result.warnings.push({
          severity: ValidationSeverity.WARNING,
          code: 'DATA_LENGTH_INCONSISTENCY',
          message: `${field} array length (${data.length}) doesn't match timestamps (${timestampLength})`,
          field: `${fieldPrefix}.indicators.quote[0].${field}`,
          suggestion: 'Check data synchronization and completeness'
        });
      }
    });
  }

  /**
   * Validate symbol format
   */
  private static isValidSymbolFormat(symbol: string): boolean {
    // Basic validation for common symbol formats
    const patterns = [
      /^[A-Z]{1,5}$/, // Stock symbols (AAPL, MSFT)
      /^[A-Z]{1,3}=F$/, // Futures (CL=F, GC=F)
      /^[A-Z]{1,5}\.[A-Z]{1,3}$/, // International (TSM.TW)
      /^\^[A-Z0-9]+$/, // Indices (^GSPC, ^IXIC)
    ];

    return patterns.some(pattern => pattern.test(symbol));
  }

  /**
   * Validate price against known commodity ranges
   */
  private static validatePriceRange(
    symbol: string,
    price: number,
    result: DataValidationResult,
    fieldPrefix: string
  ): void {
    // Find commodity configuration
    const commodityConfig = Object.values(COMMODITY_SYMBOLS).find(config => config.symbol === symbol);
    if (!commodityConfig) return;

    const validationKey = Object.keys(COMMODITY_SYMBOLS).find(
      key => (COMMODITY_SYMBOLS as any)[key].symbol === symbol
    );
    
    if (!validationKey) return;

    const priceRange = (VALIDATION_RULES.PRICE_RANGES as any)[validationKey];
    if (!priceRange) return;

    if (price < priceRange.min || price > priceRange.max) {
      result.warnings.push({
        severity: ValidationSeverity.WARNING,
        code: 'PRICE_OUT_OF_RANGE',
        message: `Price ${price} is outside expected range [${priceRange.min}, ${priceRange.max}] for ${commodityConfig.name}`,
        field: `${fieldPrefix}.meta.regularMarketPrice`,
        actual: price,
        expected: `${priceRange.min} - ${priceRange.max}`,
        suggestion: 'Verify price accuracy and check for market events'
      });
    } else if (price < priceRange.warningThresholds.low || price > priceRange.warningThresholds.high) {
      result.info.push({
        severity: ValidationSeverity.INFO,
        code: 'PRICE_UNUSUAL_RANGE',
        message: `Price ${price} is outside normal range [${priceRange.warningThresholds.low}, ${priceRange.warningThresholds.high}] for ${commodityConfig.name}`,
        field: `${fieldPrefix}.meta.regularMarketPrice`,
        actual: price,
        suggestion: 'Monitor for unusual market conditions'
      });
    }
  }

  /**
   * Validate structure against schema
   */
  private static validateStructure(
    data: any,
    schema: ValidationSchema,
    result: DataValidationResult,
    fieldPrefix: string
  ): void {
    // Check required fields
    schema.required.forEach(field => {
      if (!(field in data)) {
        result.errors.push({
          severity: ValidationSeverity.ERROR,
          code: 'MISSING_REQUIRED_FIELD',
          message: `Missing required field: ${field}`,
          field: `${fieldPrefix}.${field}`,
          suggestion: 'Check API response completeness'
        });
      }
    });

    // Check field types
    Object.entries(schema.types).forEach(([field, expectedType]) => {
      if (field in data) {
        const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
        if (actualType !== expectedType) {
          result.errors.push({
            severity: ValidationSeverity.ERROR,
            code: 'INVALID_FIELD_TYPE',
            message: `Invalid type for field ${field}`,
            field: `${fieldPrefix}.${field}`,
            expected: expectedType,
            actual: actualType,
            suggestion: 'Check data parsing and API response format'
          });
        }
      }
    });

    // Validate nested structures
    if (schema.nested) {
      Object.entries(schema.nested).forEach(([field, nestedSchema]) => {
        if (field in data && data[field]) {
          if (Array.isArray(data[field])) {
            data[field].forEach((item: any, index: number) => {
              this.validateStructure(item, nestedSchema, result, `${fieldPrefix}.${field}[${index}]`);
            });
          } else {
            this.validateStructure(data[field], nestedSchema, result, `${fieldPrefix}.${field}`);
          }
        }
      });
    }
  }

  /**
   * Calculate overall quality score
   */
  private static calculateQualityScore(result: DataValidationResult): number {
    const { errors, warnings, info } = result;
    const totalIssues = errors.length + warnings.length + info.length;
    
    if (totalIssues === 0) return 1.0;

    // Weight different issue types
    const errorWeight = 0.5;
    const warningWeight = 0.3;
    const infoWeight = 0.1;
    
    const weightedScore = 1.0 - (
      (errors.length * errorWeight + 
       warnings.length * warningWeight + 
       info.length * infoWeight) / 
      (totalIssues * errorWeight)
    );

    return Math.max(0, Math.min(1, weightedScore));
  }

  /**
   * Generate suggested fixes based on validation results
   */
  private static generateSuggestedFixes(result: DataValidationResult): string[] {
    const fixes = new Set<string>();

    result.errors.forEach(error => {
      if (error.suggestion) fixes.add(error.suggestion);
    });

    result.warnings.forEach(warning => {
      if (warning.suggestion) fixes.add(warning.suggestion);
    });

    // Add general fixes based on error patterns
    if (result.errors.some(e => e.code.includes('MISSING'))) {
      fixes.add('Check API response completeness and format');
    }

    if (result.errors.some(e => e.code.includes('TYPE'))) {
      fixes.add('Verify data parsing and transformation logic');
    }

    if (result.warnings.some(w => w.code.includes('PRICE'))) {
      fixes.add('Review market conditions and data quality');
    }

    return Array.from(fixes);
  }
}

/**
 * Data Sanitizer for cleaning and normalizing data
 */
export class DataSanitizer {
  /**
   * Sanitize Yahoo Finance response
   */
  static sanitizeResponse(response: any): any {
    if (!response || typeof response !== 'object') {
      return response;
    }

    const sanitized = { ...response };

    // Sanitize chart data
    if (sanitized.chart) {
      sanitized.chart = this.sanitizeChartData(sanitized.chart);
    }

    return sanitized;
  }

  /**
   * Sanitize chart data
   */
  private static sanitizeChartData(chartData: any): any {
    const sanitized = { ...chartData };

    if (sanitized.result && Array.isArray(sanitized.result)) {
      sanitized.result = sanitized.result.map(result => this.sanitizeChartResult(result));
    }

    return sanitized;
  }

  /**
   * Sanitize individual chart result
   */
  private static sanitizeChartResult(chartResult: any): any {
    const sanitized = { ...chartResult };

    // Sanitize metadata
    if (sanitized.meta) {
      sanitized.meta = this.sanitizeMetadata(sanitized.meta);
    }

    // Sanitize timestamps
    if (sanitized.timestamp) {
      sanitized.timestamp = this.sanitizeTimestamps(sanitized.timestamp);
    }

    // Sanitize indicators
    if (sanitized.indicators) {
      sanitized.indicators = this.sanitizeIndicators(sanitized.indicators);
    }

    return sanitized;
  }

  /**
   * Sanitize metadata
   */
  private static sanitizeMetadata(meta: any): any {
    const sanitized = { ...meta };

    // Ensure numeric fields are numbers
    const numericFields = [
      'regularMarketPrice', 'regularMarketVolume', 'regularMarketTime',
      'fiftyTwoWeekHigh', 'fiftyTwoWeekLow', 'regularMarketDayHigh', 'regularMarketDayLow'
    ];

    numericFields.forEach(field => {
      if (field in sanitized && sanitized[field] !== null) {
        const value = Number(sanitized[field]);
        sanitized[field] = isNaN(value) ? null : value;
      }
    });

    // Ensure string fields are strings
    const stringFields = ['symbol', 'currency', 'exchangeName', 'instrumentType'];
    stringFields.forEach(field => {
      if (field in sanitized && sanitized[field] !== null) {
        sanitized[field] = String(sanitized[field]);
      }
    });

    return sanitized;
  }

  /**
   * Sanitize timestamps array
   */
  private static sanitizeTimestamps(timestamps: any): number[] {
    if (!Array.isArray(timestamps)) return [];

    return timestamps
      .map(ts => {
        const num = Number(ts);
        return isNaN(num) || num <= 0 ? null : num;
      })
      .filter(ts => ts !== null) as number[];
  }

  /**
   * Sanitize indicators data
   */
  private static sanitizeIndicators(indicators: any): any {
    const sanitized = { ...indicators };

    if (sanitized.quote && Array.isArray(sanitized.quote)) {
      sanitized.quote = sanitized.quote.map(quote => this.sanitizeQuoteData(quote));
    }

    if (sanitized.adjclose && Array.isArray(sanitized.adjclose)) {
      sanitized.adjclose = sanitized.adjclose.map(adjClose => this.sanitizeAdjCloseData(adjClose));
    }

    return sanitized;
  }

  /**
   * Sanitize quote data
   */
  private static sanitizeQuoteData(quote: any): any {
    const sanitized = { ...quote };
    const priceFields = ['open', 'high', 'low', 'close', 'volume'];

    priceFields.forEach(field => {
      if (field in sanitized && Array.isArray(sanitized[field])) {
        sanitized[field] = sanitized[field].map((value: any) => {
          if (value === null || value === undefined) return null;
          const num = Number(value);
          return isNaN(num) ? null : num;
        });
      }
    });

    return sanitized;
  }

  /**
   * Sanitize adjusted close data
   */
  private static sanitizeAdjCloseData(adjClose: any): any {
    const sanitized = { ...adjClose };

    if (sanitized.adjclose && Array.isArray(sanitized.adjclose)) {
      sanitized.adjclose = sanitized.adjclose.map((value: any) => {
        if (value === null || value === undefined) return null;
        const num = Number(value);
        return isNaN(num) ? null : num;
      });
    }

    return sanitized;
  }
}

/**
 * Main validation function for Yahoo Finance responses
 */
export function validateYahooFinanceResponse(
  response: any,
  context: {
    symbol?: string;
    operation: string;
    component: string;
  }
): DataValidationResult {
  const validationContext: ValidationContext = {
    ...context,
    timestamp: new Date().toISOString()
  };

  // First sanitize the data
  const sanitizedResponse = DataSanitizer.sanitizeResponse(response);

  // Then validate
  const validationResult = YahooFinanceResponseValidator.validateResponse(
    sanitizedResponse,
    validationContext
  );

  // If validation fails, throw appropriate error
  if (!validationResult.isValid) {
    const errorContext = createErrorContext(context.component, context.operation, {
      symbol: context.symbol,
      metadata: {
        validationErrors: validationResult.errors.length,
        qualityScore: validationResult.qualityScore
      }
    });

    throw new YahooFinanceError({
      message: `Data validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
      category: ErrorCategory.DATA_VALIDATION,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.ALERT,
      context: errorContext,
      suggestedActions: validationResult.suggestedFixes
    });
  }

  return validationResult;
}

/**
 * Export validation utilities
 */
export default {
  YahooFinanceResponseValidator,
  DataSanitizer,
  validateYahooFinanceResponse,
  ValidationSeverity
};