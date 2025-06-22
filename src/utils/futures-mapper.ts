/**
 * Futures Contract Mapper Utility
 * 
 * Maps forecast time horizons (3, 6, 12, 24 months) to specific futures contract symbols
 * and provides utilities for contract symbol generation and expiration calculations.
 * 
 * @author Futures Mapper Module
 * @version 1.0.0
 */

/**
 * Futures contract month codes mapping
 */
export const FUTURES_MONTH_CODES = {
  'JAN': 'F', 'FEB': 'G', 'MAR': 'H', 'APR': 'J',
  'MAY': 'K', 'JUN': 'M', 'JUL': 'N', 'AUG': 'Q',
  'SEP': 'U', 'OCT': 'V', 'NOV': 'X', 'DEC': 'Z'
} as const;

/**
 * Reverse mapping from month codes to month names
 */
export const MONTH_CODE_TO_NAME = {
  'F': 'JAN', 'G': 'FEB', 'H': 'MAR', 'J': 'APR',
  'K': 'MAY', 'M': 'JUN', 'N': 'JUL', 'Q': 'AUG',
  'U': 'SEP', 'V': 'OCT', 'X': 'NOV', 'Z': 'DEC'
} as const;

/**
 * Contract month names array in order
 */
export const CONTRACT_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
] as const;

/**
 * Quarterly contract months for major commodities
 */
export const QUARTERLY_CONTRACTS = ['MAR', 'JUN', 'SEP', 'DEC'] as const;

/**
 * Contract expiration rules by commodity
 */
export const EXPIRATION_RULES = {
  'CL': { // Crude Oil WTI
    dayOfMonth: 20,
    monthOffset: -1, // Expires in month before delivery
    businessDaysOnly: true,
    exchangeTimezone: 'America/New_York'
  },
  'GC': { // Gold
    dayOfMonth: 27,
    monthOffset: -1,
    businessDaysOnly: true,
    exchangeTimezone: 'America/New_York'
  },
  'NG': { // Natural Gas
    dayOfMonth: 25,
    monthOffset: -1,
    businessDaysOnly: true,
    exchangeTimezone: 'America/New_York'
  }
} as const;

/**
 * Time horizon to contract month mapping strategy
 */
export interface HorizonMappingOptions {
  /** Use quarterly contracts only (MAR, JUN, SEP, DEC) */
  quarterlyOnly?: boolean;
  /** Preferred contract months */
  preferredMonths?: string[];
  /** Maximum days to expiration to consider */
  maxDaysToExpiration?: number;
  /** Minimum days to expiration to avoid near-expiry contracts */
  minDaysToExpiration?: number;
}

/**
 * Contract mapping result
 */
export interface ContractMapping {
  horizon: string;
  targetDate: Date;
  contractSymbol: string;
  contractMonth: string;
  contractYear: number;
  expirationDate: Date;
  daysToExpiration: number;
}

/**
 * Futures Mapper Class
 */
export class FuturesMapper {
  /**
   * Build futures contract symbol from components
   * 
   * @param baseSymbol - Base commodity symbol (e.g., 'CL')
   * @param month - Contract month name (e.g., 'MAR')
   * @param year - Contract year (e.g., 2025)
   * @returns Formatted futures symbol (e.g., 'CLH25')
   */
  static buildContractSymbol(baseSymbol: string, month: string, year: number): string {
    const baseCode = baseSymbol.replace('=F', ''); // Remove continuous contract suffix
    const monthCode = FUTURES_MONTH_CODES[month as keyof typeof FUTURES_MONTH_CODES];
    const yearCode = year.toString().slice(-2); // 2025 -> '25'
    
    if (!monthCode) {
      throw new Error(`Invalid contract month: ${month}`);
    }
    
    return `${baseCode}${monthCode}${yearCode}`;
  }

  /**
   * Parse futures contract symbol into components
   * 
   * @param contractSymbol - Futures symbol (e.g., 'CLH25')
   * @returns Parsed components
   */
  static parseContractSymbol(contractSymbol: string): {
    baseSymbol: string;
    monthCode: string;
    month: string;
    year: number;
  } {
    // Extract components using regex: 2-3 letter base + 1 letter month + 2 digit year
    const match = contractSymbol.match(/^([A-Z]{1,3})([FGHJKMNQUVXZ])(\d{2})$/);
    
    if (!match) {
      throw new Error(`Invalid futures contract symbol format: ${contractSymbol}`);
    }
    
    const [, baseSymbol, monthCode, yearDigits] = match;
    const month = MONTH_CODE_TO_NAME[monthCode as keyof typeof MONTH_CODE_TO_NAME];
    const year = 2000 + parseInt(yearDigits, 10);
    
    return { baseSymbol, monthCode, month, year };
  }

  /**
   * Calculate contract expiration date
   * 
   * @param baseSymbol - Base commodity symbol
   * @param month - Contract month
   * @param year - Contract year
   * @returns Expiration date
   */
  static calculateExpirationDate(baseSymbol: string, month: string, year: number): Date {
    const baseCode = baseSymbol.replace('=F', '');
    const rules = EXPIRATION_RULES[baseCode as keyof typeof EXPIRATION_RULES];
    
    if (!rules) {
      // Default expiration: 20th of the month before delivery
      const monthIndex = CONTRACT_MONTHS.indexOf(month as any);
      const expirationMonth = monthIndex === 0 ? 11 : monthIndex - 1;
      const expirationYear = monthIndex === 0 ? year - 1 : year;
      return new Date(expirationYear, expirationMonth, 20);
    }
    
    // Calculate based on commodity-specific rules
    const monthIndex = CONTRACT_MONTHS.indexOf(month as any);
    const expirationMonth = monthIndex + rules.monthOffset;
    const adjustedMonth = expirationMonth < 0 ? 11 : expirationMonth;
    const adjustedYear = expirationMonth < 0 ? year - 1 : year;
    
    const expirationDate = new Date(adjustedYear, adjustedMonth, rules.dayOfMonth);
    
    // Adjust for business days if required
    if (rules.businessDaysOnly) {
      // Move to previous business day if weekend
      while (expirationDate.getDay() === 0 || expirationDate.getDay() === 6) {
        expirationDate.setDate(expirationDate.getDate() - 1);
      }
    }
    
    return expirationDate;
  }

  /**
   * Map time horizons to contract symbols
   * 
   * @param baseSymbol - Base commodity symbol (e.g., 'CL=F')
   * @param horizons - Time horizons in months (e.g., [3, 6, 12, 24])
   * @param options - Mapping options
   * @returns Array of contract mappings
   */
  static mapHorizonsToContracts(
    baseSymbol: string,
    horizons: number[],
    options: HorizonMappingOptions = {}
  ): ContractMapping[] {
    const {
      quarterlyOnly = false,
      preferredMonths = quarterlyOnly ? [...QUARTERLY_CONTRACTS] : [...CONTRACT_MONTHS],
      maxDaysToExpiration = 1095, // 3 years
      minDaysToExpiration = 30 // 1 month
    } = options;

    const currentDate = new Date();
    const mappings: ContractMapping[] = [];

    for (const horizonMonths of horizons) {
      const targetDate = new Date(currentDate);
      targetDate.setMonth(targetDate.getMonth() + horizonMonths);

      // Find the best matching contract
      const bestContract = this.findBestContract(
        baseSymbol,
        targetDate,
        preferredMonths,
        minDaysToExpiration,
        maxDaysToExpiration
      );

      if (bestContract) {
        mappings.push({
          horizon: `${horizonMonths}-month`,
          targetDate,
          ...bestContract
        });
      }
    }

    return mappings;
  }

  /**
   * Find the best contract for a target date
   * 
   * @param baseSymbol - Base commodity symbol
   * @param targetDate - Target forecast date
   * @param availableMonths - Available contract months
   * @param minDays - Minimum days to expiration
   * @param maxDays - Maximum days to expiration
   * @returns Best contract mapping or null
   */
  private static findBestContract(
    baseSymbol: string,
    targetDate: Date,
    availableMonths: readonly string[],
    minDays: number,
    maxDays: number
  ): Omit<ContractMapping, 'horizon' | 'targetDate'> | null {
    const currentDate = new Date();
    let bestContract: Omit<ContractMapping, 'horizon' | 'targetDate'> | null = null;
    let bestScore = Infinity;

    // Check contracts in target year and following year
    for (const year of [targetDate.getFullYear(), targetDate.getFullYear() + 1]) {
      for (const month of availableMonths) {
        const contractSymbol = this.buildContractSymbol(baseSymbol, month, year);
        const expirationDate = this.calculateExpirationDate(baseSymbol, month, year);
        const daysToExpiration = Math.floor(
          (expirationDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Skip if outside acceptable expiration range
        if (daysToExpiration < minDays || daysToExpiration > maxDays) {
          continue;
        }

        // Score based on proximity to target date (prefer contracts expiring after target)
        const daysDifference = Math.abs(expirationDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24);
        const isAfterTarget = expirationDate >= targetDate;
        const score = daysDifference + (isAfterTarget ? 0 : 1000); // Penalty for expiring before target

        if (score < bestScore) {
          bestScore = score;
          bestContract = {
            contractSymbol,
            contractMonth: month,
            contractYear: year,
            expirationDate,
            daysToExpiration
          };
        }
      }
    }

    return bestContract;
  }

  /**
   * Get standard forecast horizon mappings for crude oil
   * 
   * @param baseSymbol - Base symbol (default: 'CL=F')
   * @returns Standard mappings for 3, 6, 12, 24 month horizons
   */
  static getStandardCrudeOilMappings(baseSymbol: string = 'CL=F'): ContractMapping[] {
    return this.mapHorizonsToContracts(baseSymbol, [3, 6, 12, 24], {
      quarterlyOnly: true, // Use quarterly contracts for better liquidity
      minDaysToExpiration: 30
    });
  }

  /**
   * Validate contract symbol format
   * 
   * @param contractSymbol - Symbol to validate
   * @returns True if valid format
   */
  static isValidContractSymbol(contractSymbol: string): boolean {
    try {
      this.parseContractSymbol(contractSymbol);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get days until expiration for a contract
   * 
   * @param contractSymbol - Contract symbol
   * @returns Days until expiration
   */
  static getDaysToExpiration(contractSymbol: string): number {
    const parsed = this.parseContractSymbol(contractSymbol);
    const expirationDate = this.calculateExpirationDate(
      parsed.baseSymbol, 
      parsed.month, 
      parsed.year
    );
    
    const currentDate = new Date();
    return Math.floor((expirationDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
  }
}

/**
 * Convenience function to get contract mappings for standard horizons
 * 
 * @param baseSymbol - Base commodity symbol
 * @param options - Mapping options
 * @returns Contract mappings for 3, 6, 12, 24 months
 */
export function getStandardContractMappings(
  baseSymbol: string = 'CL=F',
  options: HorizonMappingOptions = {}
): ContractMapping[] {
  return FuturesMapper.mapHorizonsToContracts(baseSymbol, [3, 6, 12, 24], options);
}

/**
 * Convenience function to build a single contract symbol
 * 
 * @param baseSymbol - Base symbol
 * @param month - Contract month
 * @param year - Contract year
 * @returns Formatted contract symbol
 */
export function buildContractSymbol(baseSymbol: string, month: string, year: number): string {
  return FuturesMapper.buildContractSymbol(baseSymbol, month, year);
}