/**
 * Unit Tests for Price Validator Module
 */

import {
  PriceValidator,
  getPriceValidator,
  createPriceValidator,
  validatePrice,
  isPriceAcceptable,
  COMMODITY_VALIDATION_RULES,
  ValidationResult,
  PriceData,
  CommodityValidationRules
} from './price-validator';

describe('PriceValidator', () => {
  let validator: PriceValidator;

  beforeEach(() => {
    validator = new PriceValidator();
  });

  describe('validatePrice', () => {
    const validCrudeOilData: PriceData = {
      price: 75.50,
      currency: 'USD',
      unit: 'per barrel',
      timestamp: new Date().toISOString(),
      symbol: 'CL=F',
      source: 'Yahoo Finance'
    };

    it('should validate correct crude oil price data', () => {
      const result = validator.validatePrice(validCrudeOilData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.priceRange).toBeDefined();
    });

    it('should reject negative prices', () => {
      const invalidData = { ...validCrudeOilData, price: -10 };
      const result = validator.validatePrice(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price must be positive');
    });

    it('should reject zero prices', () => {
      const invalidData = { ...validCrudeOilData, price: 0 };
      const result = validator.validatePrice(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price must be positive');
    });

    it('should reject prices outside acceptable range', () => {
      const rules = COMMODITY_VALIDATION_RULES['CL=F'];
      
      // Test below minimum
      const tooLow = { ...validCrudeOilData, price: rules.priceRange.min - 1 };
      const resultLow = validator.validatePrice(tooLow);
      expect(resultLow.isValid).toBe(false);
      expect(resultLow.errors[0]).toContain('outside acceptable range');
      
      // Test above maximum
      const tooHigh = { ...validCrudeOilData, price: rules.priceRange.max + 1 };
      const resultHigh = validator.validatePrice(tooHigh);
      expect(resultHigh.isValid).toBe(false);
      expect(resultHigh.errors[0]).toContain('outside acceptable range');
    });

    it('should warn about prices in warning zones', () => {
      const rules = COMMODITY_VALIDATION_RULES['CL=F'];
      
      // Test warning low
      const warningLow = { ...validCrudeOilData, price: rules.priceRange.warningLow - 5 };
      const resultLow = validator.validatePrice(warningLow);
      expect(resultLow.isValid).toBe(true);
      expect(resultLow.warnings.some(w => w.includes('unusually low'))).toBe(true);
      expect(resultLow.confidence).toBeLessThan(1.0);
      
      // Test warning high
      const warningHigh = { ...validCrudeOilData, price: rules.priceRange.warningHigh + 5 };
      const resultHigh = validator.validatePrice(warningHigh);
      expect(resultHigh.isValid).toBe(true);
      expect(resultHigh.warnings.some(w => w.includes('unusually high'))).toBe(true);
      expect(resultHigh.confidence).toBeLessThan(1.0);
    });

    it('should boost confidence for typical price range', () => {
      const rules = COMMODITY_VALIDATION_RULES['CL=F'];
      const typicalPrice = (rules.priceRange.typicalMin + rules.priceRange.typicalMax) / 2;
      
      const typicalData = { ...validCrudeOilData, price: typicalPrice };
      const result = validator.validatePrice(typicalData);
      
      expect(result.confidence).toBeGreaterThan(1.0); // Boosted for typical range
    });

    it('should validate currency', () => {
      const wrongCurrency = { ...validCrudeOilData, currency: 'EUR' };
      const result = validator.validatePrice(wrongCurrency);
      
      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings.some(w => w.includes('Expected currency USD'))).toBe(true);
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('should validate unit', () => {
      const wrongUnit = { ...validCrudeOilData, unit: 'per gallon' };
      const result = validator.validatePrice(wrongUnit);
      
      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings.some(w => w.includes('Expected unit'))).toBe(true);
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('should validate timestamp freshness', () => {
      const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours old
      const staleData = { ...validCrudeOilData, timestamp: oldTimestamp };
      const result = validator.validatePrice(staleData);
      
      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings.some(w => w.includes('minutes old'))).toBe(true);
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('should reject invalid timestamp', () => {
      const invalidData = { ...validCrudeOilData, timestamp: 'invalid-date' };
      const result = validator.validatePrice(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid timestamp format');
    });

    it('should warn about future timestamps', () => {
      const futureTimestamp = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour future
      const futureData = { ...validCrudeOilData, timestamp: futureTimestamp };
      const result = validator.validatePrice(futureData);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Timestamp is in the future');
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('should validate price trends when previous price provided', () => {
      const rules = COMMODITY_VALIDATION_RULES['CL=F'];
      const volatileData = {
        ...validCrudeOilData,
        price: 75.50,
        previousPrice: 60.00 // Large change
      };
      
      const result = validator.validatePrice(volatileData);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('Large price movement'))).toBe(true);
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('should boost confidence for trusted sources', () => {
      const yahooData = { ...validCrudeOilData, source: 'Yahoo Finance' };
      const unknownData = { ...validCrudeOilData, source: 'Unknown Source' };
      
      const yahooResult = validator.validatePrice(yahooData);
      const unknownResult = validator.validatePrice(unknownData);
      
      expect(yahooResult.confidence).toBeGreaterThan(unknownResult.confidence);
    });

    it('should handle missing symbol gracefully', () => {
      const dataWithoutSymbol = { ...validCrudeOilData };
      delete dataWithoutSymbol.symbol;
      
      const result = validator.validatePrice(dataWithoutSymbol);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No commodity symbol provided for validation');
    });

    it('should handle unknown symbols with basic validation', () => {
      const unknownSymbolData = { ...validCrudeOilData, symbol: 'UNKNOWN=F' };
      const result = validator.validatePrice(unknownSymbolData);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('No validation rules found'))).toBe(true);
      expect(result.confidence).toBeLessThan(1.0);
    });
  });

  describe('validateMultiplePrices', () => {
    it('should validate multiple price data points', () => {
      const priceDataArray: PriceData[] = [
        {
          price: 75.50,
          currency: 'USD',
          unit: 'per barrel',
          timestamp: new Date().toISOString(),
          symbol: 'CL=F'
        },
        {
          price: 76.00,
          currency: 'USD',
          unit: 'per barrel',
          timestamp: new Date().toISOString(),
          symbol: 'CL=F'
        },
        {
          price: -10, // Invalid
          currency: 'USD',
          unit: 'per barrel',
          timestamp: new Date().toISOString(),
          symbol: 'CL=F'
        }
      ];

      const results = validator.validateMultiplePrices(priceDataArray);
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
    });
  });

  describe('crossValidatePrices', () => {
    it('should cross-validate prices from multiple sources', () => {
      const prices = [
        {
          source: 'Yahoo Finance',
          data: {
            price: 75.50,
            currency: 'USD',
            unit: 'per barrel',
            timestamp: new Date().toISOString(),
            symbol: 'CL=F'
          }
        },
        {
          source: 'Reuters',
          data: {
            price: 75.45,
            currency: 'USD',
            unit: 'per barrel',
            timestamp: new Date().toISOString(),
            symbol: 'CL=F'
          }
        }
      ];

      const result = validator.crossValidatePrices(prices);
      
      expect(result.isValid).toBe(true);
      expect(result.metadata?.meanPrice).toBeCloseTo(75.475, 3);
      expect(result.metadata?.sourceCount).toBe(2);
      expect(result.metadata?.priceVariance).toBeDefined();
    });

    it('should warn about high price variance', () => {
      const prices = [
        {
          source: 'Source1',
          data: {
            price: 75.00,
            currency: 'USD',
            unit: 'per barrel',
            timestamp: new Date().toISOString(),
            symbol: 'CL=F'
          }
        },
        {
          source: 'Source2',
          data: {
            price: 80.00, // 6.67% higher
            currency: 'USD',
            unit: 'per barrel',
            timestamp: new Date().toISOString(),
            symbol: 'CL=F'
          }
        }
      ];

      const result = validator.crossValidatePrices(prices);
      
      expect(result.warnings.some(w => w.includes('High price variance'))).toBe(true);
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('should warn about individual price deviations', () => {
      const prices = [
        {
          source: 'Accurate Source 1',
          data: { price: 75.00, currency: 'USD', unit: 'per barrel', timestamp: new Date().toISOString(), symbol: 'CL=F' }
        },
        {
          source: 'Accurate Source 2',
          data: { price: 75.10, currency: 'USD', unit: 'per barrel', timestamp: new Date().toISOString(), symbol: 'CL=F' }
        },
        {
          source: 'Outlier Source',
          data: { price: 85.00, currency: 'USD', unit: 'per barrel', timestamp: new Date().toISOString(), symbol: 'CL=F' }
        }
      ];

      const result = validator.crossValidatePrices(prices);
      
      expect(result.warnings.some(w => w.includes('Outlier Source') && w.includes('deviates significantly'))).toBe(true);
    });

    it('should handle insufficient sources', () => {
      const prices = [
        {
          source: 'Single Source',
          data: { price: 75.00, currency: 'USD', unit: 'per barrel', timestamp: new Date().toISOString(), symbol: 'CL=F' }
        }
      ];

      const result = validator.crossValidatePrices(prices);
      
      expect(result.warnings).toContain('Cross-validation requires at least 2 price sources');
    });
  });

  describe('Custom Validation Rules', () => {
    it('should add and use custom validation rules', () => {
      const customRules: CommodityValidationRules = {
        symbol: 'CUSTOM=F',
        name: 'Custom Commodity',
        priceRange: {
          min: 100,
          max: 200,
          warningLow: 110,
          warningHigh: 190,
          typicalMin: 120,
          typicalMax: 180
        },
        currency: 'EUR',
        unit: 'per unit',
        maxDataAge: 60 * 1000, // 1 minute
        minConfidence: 0.8,
        volatilityFactor: 0.05
      };

      validator.addValidationRules('CUSTOM=F', customRules);

      const customData: PriceData = {
        price: 150,
        currency: 'EUR',
        unit: 'per unit',
        timestamp: new Date().toISOString(),
        symbol: 'CUSTOM=F'
      };

      const result = validator.validatePrice(customData);
      
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);

      // Test custom range
      const invalidCustomData = { ...customData, price: 250 };
      const invalidResult = validator.validatePrice(invalidCustomData);
      expect(invalidResult.isValid).toBe(false);
    });

    it('should retrieve validation rules', () => {
      const rules = validator.getValidationRules('CL=F');
      expect(rules).toBeDefined();
      expect(rules?.symbol).toBe('CL=F');
      expect(rules?.name).toBe('WTI Crude Oil');
    });
  });

  describe('isPriceAcceptable', () => {
    it('should check if price is acceptable within tolerance', () => {
      const rules = COMMODITY_VALIDATION_RULES['CL=F'];
      
      // Within range
      expect(validator.isPriceAcceptable(75.50, 'CL=F')).toBe(true);
      
      // Outside range but within tolerance
      const tolerance = 0.1; // 10%
      const slightlyOutside = rules.priceRange.max + 1;
      expect(validator.isPriceAcceptable(slightlyOutside, 'CL=F', tolerance)).toBe(true);
      
      // Way outside range
      expect(validator.isPriceAcceptable(500, 'CL=F')).toBe(false);
    });

    it('should accept any price for unknown symbols', () => {
      expect(validator.isPriceAcceptable(999999, 'UNKNOWN=F')).toBe(true);
    });
  });

  describe('Different Commodities', () => {
    it('should validate gold prices correctly', () => {
      const goldData: PriceData = {
        price: 1900,
        currency: 'USD',
        unit: 'per troy ounce',
        timestamp: new Date().toISOString(),
        symbol: 'GC=F'
      };

      const result = validator.validatePrice(goldData);
      
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should validate silver prices correctly', () => {
      const silverData: PriceData = {
        price: 25.50,
        currency: 'USD',
        unit: 'per troy ounce',
        timestamp: new Date().toISOString(),
        symbol: 'SI=F'
      };

      const result = validator.validatePrice(silverData);
      
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should validate natural gas prices correctly', () => {
      const naturalGasData: PriceData = {
        price: 4.50,
        currency: 'USD',
        unit: 'per MMBtu',
        timestamp: new Date().toISOString(),
        symbol: 'NG=F'
      };

      const result = validator.validatePrice(naturalGasData);
      
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', () => {
      // Force an error by providing malformed data
      const malformedData = {
        price: 'not-a-number' as any,
        currency: 'USD',
        unit: 'per barrel',
        timestamp: new Date().toISOString(),
        symbol: 'CL=F'
      };

      const result = validator.validatePrice(malformedData);
      
      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Factory Functions', () => {
  it('should create singleton instance', () => {
    const instance1 = getPriceValidator();
    const instance2 = getPriceValidator();
    
    expect(instance1).toBe(instance2);
  });

  it('should create new instance', () => {
    const instance1 = createPriceValidator();
    const instance2 = createPriceValidator();
    
    expect(instance1).not.toBe(instance2);
  });
});

describe('Convenience Functions', () => {
  const validData: PriceData = {
    price: 75.50,
    currency: 'USD',
    unit: 'per barrel',
    timestamp: new Date().toISOString(),
    symbol: 'CL=F'
  };

  it('should validate price using convenience function', () => {
    const result = validatePrice(validData);
    
    expect(result.isValid).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should check price acceptability using convenience function', () => {
    expect(isPriceAcceptable(75.50, 'CL=F')).toBe(true);
    expect(isPriceAcceptable(500, 'CL=F')).toBe(false);
  });
});