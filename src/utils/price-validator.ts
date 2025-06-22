/**
 * Price Validation Utility Module
 * 
 * Comprehensive price validation system for commodity data with commodity-specific
 * validation rules, range checking, currency validation, timestamp validation,
 * and confidence scoring for data quality assessment.
 * 
 * Features:
 * - Commodity-specific price range validation
 * - Currency and unit consistency checks
 * - Timestamp and data freshness validation
 * - Confidence scoring for data quality
 * - Cross-validation logic for multiple data sources
 * - Historical price trend analysis
 * - Outlier detection and anomaly checking
 * 
 * @author Price Validator Module
 * @version 1.0.0
 */

/**
 * Validation result structure
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Additional validation metadata */
  metadata?: {
    priceRange?: { min: number; max: number; };
    dateFreshness?: number;
    outlierScore?: number;
    [key: string]: any;
  };
}

/**
 * Price range configuration for commodities
 */
export interface PriceRange {
  /** Minimum acceptable price */
  min: number;
  /** Maximum acceptable price */
  max: number;
  /** Warning threshold for low prices */
  warningLow: number;
  /** Warning threshold for high prices */
  warningHigh: number;
  /** Expected typical range minimum */
  typicalMin: number;
  /** Expected typical range maximum */
  typicalMax: number;
}

/**
 * Commodity validation rules
 */
export interface CommodityValidationRules {
  /** Commodity symbol */
  symbol: string;
  /** Commodity name */
  name: string;
  /** Price range configuration */
  priceRange: PriceRange;
  /** Expected currency */
  currency: string;
  /** Expected unit */
  unit: string;
  /** Maximum data age in milliseconds */
  maxDataAge: number;
  /** Minimum confidence score required */
  minConfidence: number;
  /** Historical volatility factor (for outlier detection) */
  volatilityFactor: number;
}

/**
 * Price data structure for validation
 */
export interface PriceData {
  /** Current price */
  price: number;
  /** Currency */
  currency: string;
  /** Unit */
  unit: string;
  /** Timestamp */
  timestamp: string | Date;
  /** Optional previous price for trend analysis */
  previousPrice?: number;
  /** Optional source information */
  source?: string;
  /** Optional symbol */
  symbol?: string;
}

/**
 * Predefined validation rules for common commodities
 */
export const COMMODITY_VALIDATION_RULES: Record<string, CommodityValidationRules> = {
  'CL=F': {
    symbol: 'CL=F',
    name: 'WTI Crude Oil',
    priceRange: {
      min: 10,
      max: 200,
      warningLow: 30,
      warningHigh: 150,
      typicalMin: 50,
      typicalMax: 120
    },
    currency: 'USD',
    unit: 'per barrel',
    maxDataAge: 30 * 60 * 1000, // 30 minutes
    minConfidence: 0.7,
    volatilityFactor: 0.15 // 15% daily volatility threshold
  },
  'GC=F': {
    symbol: 'GC=F',
    name: 'Gold',
    priceRange: {
      min: 1000,
      max: 3000,
      warningLow: 1500,
      warningHigh: 2500,
      typicalMin: 1700,
      typicalMax: 2200
    },
    currency: 'USD',
    unit: 'per troy ounce',
    maxDataAge: 30 * 60 * 1000,
    minConfidence: 0.8,
    volatilityFactor: 0.08 // 8% daily volatility threshold
  },
  'SI=F': {
    symbol: 'SI=F',
    name: 'Silver',
    priceRange: {
      min: 10,
      max: 50,
      warningLow: 15,
      warningHigh: 40,
      typicalMin: 20,
      typicalMax: 35
    },
    currency: 'USD',
    unit: 'per troy ounce',
    maxDataAge: 30 * 60 * 1000,
    minConfidence: 0.7,
    volatilityFactor: 0.12 // 12% daily volatility threshold
  },
  'NG=F': {
    symbol: 'NG=F',
    name: 'Natural Gas',
    priceRange: {
      min: 1,
      max: 15,
      warningLow: 2,
      warningHigh: 10,
      typicalMin: 2.5,
      typicalMax: 7
    },
    currency: 'USD',
    unit: 'per MMBtu',
    maxDataAge: 30 * 60 * 1000,
    minConfidence: 0.7,
    volatilityFactor: 0.20 // 20% daily volatility threshold
  }
};

/**
 * Price Validator Class
 */
export class PriceValidator {
  private logger: Console;
  private validationRules: Map<string, CommodityValidationRules>;

  constructor() {
    this.logger = console;
    this.validationRules = new Map();
    
    // Load default rules
    Object.values(COMMODITY_VALIDATION_RULES).forEach(rules => {
      this.validationRules.set(rules.symbol, rules);
    });
  }

  /**
   * Validate price data for a specific commodity
   */
  validatePrice(priceData: PriceData, symbol?: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      confidence: 1.0,
      metadata: {}
    };

    try {
      const commoditySymbol = symbol || priceData.symbol;
      if (!commoditySymbol) {
        result.errors.push('No commodity symbol provided for validation');
        result.isValid = false;
        return result;
      }

      const rules = this.validationRules.get(commoditySymbol);
      if (!rules) {
        result.warnings.push(`No validation rules found for symbol: ${commoditySymbol}`);
        result.confidence -= 0.2;
        return this.basicValidation(priceData, result);
      }

      // Validate price range
      this.validatePriceRange(priceData.price, rules, result);

      // Validate currency
      this.validateCurrency(priceData.currency, rules, result);

      // Validate unit
      this.validateUnit(priceData.unit, rules, result);

      // Validate timestamp and data freshness
      this.validateTimestamp(priceData.timestamp, rules, result);

      // Validate price trends (if previous price available)
      if (priceData.previousPrice) {
        this.validatePriceTrend(priceData.price, priceData.previousPrice, rules, result);
      }

      // Calculate final confidence score
      this.calculateConfidenceScore(priceData, rules, result);

      // Store metadata
      result.metadata = {
        priceRange: rules.priceRange,
        dateFreshness: this.getDataAge(priceData.timestamp),
        outlierScore: this.calculateOutlierScore(priceData.price, rules)
      };

    } catch (error) {
      result.errors.push(`Validation error: ${(error as Error).message}`);
      result.isValid = false;
      result.confidence = 0;
    }

    return result;
  }

  /**
   * Validate multiple price data points
   */
  validateMultiplePrices(priceDataArray: PriceData[], symbol?: string): ValidationResult[] {
    return priceDataArray.map(priceData => this.validatePrice(priceData, symbol));
  }

  /**
   * Cross-validate price data from multiple sources
   */
  crossValidatePrices(prices: Array<{ source: string; data: PriceData }>): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      confidence: 1.0,
      metadata: {}
    };

    if (prices.length < 2) {
      result.warnings.push('Cross-validation requires at least 2 price sources');
      return result;
    }

    const priceValues = prices.map(p => p.data.price);
    const mean = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
    const standardDeviation = Math.sqrt(
      priceValues.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / priceValues.length
    );

    // Check for significant price discrepancies
    const maxDeviation = standardDeviation / mean;
    if (maxDeviation > 0.05) { // 5% deviation threshold
      result.warnings.push(`High price variance across sources: ${(maxDeviation * 100).toFixed(2)}%`);
      result.confidence -= Math.min(0.3, maxDeviation * 2);
    }

    // Check individual prices against mean
    prices.forEach(({ source, data }) => {
      const deviation = Math.abs(data.price - mean) / mean;
      if (deviation > 0.10) { // 10% deviation from mean
        result.warnings.push(`Price from ${source} deviates significantly from mean: ${(deviation * 100).toFixed(2)}%`);
      }
    });

    result.metadata = {
      meanPrice: mean,
      standardDeviation,
      priceVariance: maxDeviation,
      sourceCount: prices.length
    };

    return result;
  }

  /**
   * Add custom validation rules for a commodity
   */
  addValidationRules(symbol: string, rules: CommodityValidationRules): void {
    this.validationRules.set(symbol, rules);
    this.logger.log(`[PriceValidator] Added custom validation rules for ${symbol}`);
  }

  /**
   * Get validation rules for a symbol
   */
  getValidationRules(symbol: string): CommodityValidationRules | undefined {
    return this.validationRules.get(symbol);
  }

  /**
   * Check if price is within acceptable range with tolerance
   */
  isPriceAcceptable(price: number, symbol: string, tolerance: number = 0.05): boolean {
    const rules = this.validationRules.get(symbol);
    if (!rules) return true; // No rules = accept

    const toleranceAmount = (rules.priceRange.max - rules.priceRange.min) * tolerance;
    return price >= (rules.priceRange.min - toleranceAmount) && 
           price <= (rules.priceRange.max + toleranceAmount);
  }

  // Private validation methods

  private validatePriceRange(price: number, rules: CommodityValidationRules, result: ValidationResult): void {
    const { priceRange } = rules;

    if (price <= 0) {
      result.errors.push('Price must be positive');
      result.isValid = false;
      return;
    }

    if (price < priceRange.min || price > priceRange.max) {
      result.errors.push(
        `Price ${price} outside acceptable range [${priceRange.min}, ${priceRange.max}] for ${rules.name}`
      );
      result.isValid = false;
      return;
    }

    if (price < priceRange.warningLow) {
      result.warnings.push(`Price ${price} is unusually low for ${rules.name} (below ${priceRange.warningLow})`);
      result.confidence -= 0.1;
    }

    if (price > priceRange.warningHigh) {
      result.warnings.push(`Price ${price} is unusually high for ${rules.name} (above ${priceRange.warningHigh})`);
      result.confidence -= 0.1;
    }

    // Check if within typical range
    if (price >= priceRange.typicalMin && price <= priceRange.typicalMax) {
      result.confidence += 0.1; // Boost confidence for typical prices
    }
  }

  private validateCurrency(currency: string, rules: CommodityValidationRules, result: ValidationResult): void {
    if (currency !== rules.currency) {
      result.warnings.push(`Expected currency ${rules.currency}, got ${currency}`);
      result.confidence -= 0.05;
    }
  }

  private validateUnit(unit: string, rules: CommodityValidationRules, result: ValidationResult): void {
    if (!unit.toLowerCase().includes(rules.unit.toLowerCase())) {
      result.warnings.push(`Expected unit containing "${rules.unit}", got "${unit}"`);
      result.confidence -= 0.05;
    }
  }

  private validateTimestamp(timestamp: string | Date, rules: CommodityValidationRules, result: ValidationResult): void {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      const now = new Date();
      
      if (isNaN(date.getTime())) {
        result.errors.push('Invalid timestamp format');
        result.isValid = false;
        return;
      }

      const age = now.getTime() - date.getTime();
      
      if (age < 0) {
        result.warnings.push('Timestamp is in the future');
        result.confidence -= 0.1;
      }

      if (age > rules.maxDataAge) {
        const ageMinutes = Math.floor(age / (60 * 1000));
        const maxAgeMinutes = Math.floor(rules.maxDataAge / (60 * 1000));
        result.warnings.push(`Data is ${ageMinutes} minutes old (max acceptable: ${maxAgeMinutes} minutes)`);
        result.confidence -= Math.min(0.3, age / rules.maxDataAge - 1);
      }
    } catch (error) {
      result.errors.push(`Timestamp validation error: ${(error as Error).message}`);
      result.isValid = false;
    }
  }

  private validatePriceTrend(currentPrice: number, previousPrice: number, rules: CommodityValidationRules, result: ValidationResult): void {
    const priceChange = Math.abs(currentPrice - previousPrice) / previousPrice;
    
    if (priceChange > rules.volatilityFactor) {
      const changePercent = (priceChange * 100).toFixed(2);
      result.warnings.push(
        `Large price movement: ${changePercent}% change from previous price (threshold: ${(rules.volatilityFactor * 100).toFixed(1)}%)`
      );
      result.confidence -= Math.min(0.2, priceChange - rules.volatilityFactor);
    }
  }

  private calculateConfidenceScore(priceData: PriceData, rules: CommodityValidationRules, result: ValidationResult): void {
    // Ensure confidence doesn't go below 0
    result.confidence = Math.max(0, result.confidence);

    // Additional confidence factors
    if (priceData.source && priceData.source.toLowerCase().includes('yahoo')) {
      result.confidence += 0.05; // Boost for trusted sources
    }

    if (result.confidence < rules.minConfidence) {
      result.warnings.push(`Confidence score ${result.confidence.toFixed(2)} below minimum required ${rules.minConfidence}`);
    }

    // Cap confidence at 1.0
    result.confidence = Math.min(1.0, result.confidence);
  }

  private calculateOutlierScore(price: number, rules: CommodityValidationRules): number {
    const { typicalMin, typicalMax } = rules.priceRange;
    const typicalMid = (typicalMin + typicalMax) / 2;
    const typicalRange = typicalMax - typicalMin;
    
    const deviation = Math.abs(price - typicalMid) / (typicalRange / 2);
    return Math.min(1.0, deviation);
  }

  private getDataAge(timestamp: string | Date): number {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return Date.now() - date.getTime();
  }

  private basicValidation(priceData: PriceData, result: ValidationResult): ValidationResult {
    // Basic validation when no specific rules are available
    if (priceData.price <= 0) {
      result.errors.push('Price must be positive');
      result.isValid = false;
    }

    if (priceData.price > 1000000) {
      result.warnings.push('Price appears unusually high');
      result.confidence -= 0.2;
    }

    if (!priceData.currency) {
      result.warnings.push('No currency specified');
      result.confidence -= 0.1;
    }

    return result;
  }
}

/**
 * Singleton validator instance
 */
let validatorInstance: PriceValidator | null = null;

/**
 * Get singleton price validator instance
 */
export function getPriceValidator(): PriceValidator {
  if (!validatorInstance) {
    validatorInstance = new PriceValidator();
  }
  return validatorInstance;
}

/**
 * Create new price validator instance
 */
export function createPriceValidator(): PriceValidator {
  return new PriceValidator();
}

/**
 * Convenience function to validate a single price
 */
export function validatePrice(priceData: PriceData, symbol?: string): ValidationResult {
  return getPriceValidator().validatePrice(priceData, symbol);
}

/**
 * Convenience function to check if price is acceptable
 */
export function isPriceAcceptable(price: number, symbol: string, tolerance?: number): boolean {
  return getPriceValidator().isPriceAcceptable(price, symbol, tolerance);
}

// Export default
export default PriceValidator;