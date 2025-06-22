// Source information for data attribution
export interface SourceInfo {
  name: string;
  url?: string;
  date: string;
  reliability: 'high' | 'medium' | 'low';
}

// Basic commodity information
export interface CommodityData {
  symbol: string;
  name: string;
  type: 'commodity' | 'futures_contract';
  unit: string;
  currentPrice: number;
  currency: string;
  lastUpdated: string;
  sources: SourceInfo[];
}

// Forecast data for different time horizons
export interface ForecastData {
  horizon: '3-month' | '6-month' | '12-month' | '24-month';
  forecastPrice: number;
  currency: string;
  confidenceLevel?: number; // 0-100 percentage
  dateRange: {
    start: string;
    end: string;
  };
  percentageChange: number;
  sources: SourceInfo[];
  methodology?: string;
  keyFactors?: string[];
}

// Futures contract data extending base commodity data
export interface FuturesContract extends CommodityData {
  type: 'futures_contract';
  contractDetails: {
    expirationDate: string;
    deliveryMonth: string;
    contractYear: number;
    daysToExpiration: number;
    contractSize: number;
    tickValue: number;
    settlementType: 'physical' | 'cash';
  };
  underlyingAsset: {
    symbol: string;
    name: string;
    category: string;
  };
  priceMetrics: {
    basis: number; // Difference from spot price
    openInterest?: number;
    volume?: number;
    impliedVolatility?: number;
  };
  // Add missing properties for compatibility
  volume?: number; // Top-level volume access
}

// Futures curve for term structure analysis
export interface FuturesCurve {
  underlyingSymbol: string;
  curveDate: string;
  contracts: Array<{
    symbol: string;
    maturity: string;
    price: number;
    volume?: number;
    openInterest?: number;
    daysToExpiration: number;
  }>;
  curveMetrics: {
    contango: boolean; // True if far month > near month
    backwardation: boolean; // True if near month > far month
    averageSpread: number; // Average price difference between contracts
    steepness: number; // Price change per month
  };
  sources: SourceInfo[];
  lastUpdated: string;
}

// Risk adjustment data for forecast modifications
export interface RiskAdjustment {
  riskType: 'geopolitical' | 'supply_demand' | 'economic' | 'weather' | 'regulatory';
  adjustmentFactor: number; // Percentage adjustment to apply
  confidenceImpact: number; // Impact on confidence level (-1 to 1)
  description: string;
  methodology: string;
  validityPeriod: {
    start: string;
    end: string;
  };
  sources: SourceInfo[];
}

// Enhanced forecast data with market consensus baseline
export interface MarketConsensusForcast extends ForecastData {
  marketConsensusPrice: number; // Price from futures curve
  riskAdjustedPrice: number; // Final forecast after risk adjustments
  riskAdjustments: RiskAdjustment[];
  confidenceInterval: {
    lower: number;
    upper: number;
    confidence: number; // e.g., 95 for 95% confidence interval
  };
}

// Complete commodity analysis with all forecasts
export interface CommodityAnalysis {
  commodity: CommodityData;
  forecasts: ForecastData[];
  analysisDate: string;
  overallTrend: 'bullish' | 'bearish' | 'neutral';
  riskFactors?: string[];
  marketSentiment?: string;
}

// Web search result structure
export interface WebSearchResult {
  content: string;
  timestamp: string;
  success: boolean;
  sources?: SourceInfo[];
}

// Crude oil specific data
export const CRUDE_OIL_CONFIG = {
  symbol: 'CL=F',
  name: 'Crude Oil (WTI)',
  type: 'commodity' as const,
  unit: 'USD per barrel',
  currency: 'USD'
} as const;

// Forecast horizon configurations
export const FORECAST_HORIZONS = [
  { key: '3-month', months: 3, label: '3 Month Outlook' },
  { key: '6-month', months: 6, label: '6 Month Outlook' },
  { key: '12-month', months: 12, label: '12 Month Outlook' },
  { key: '24-month', months: 24, label: '24 Month Outlook' }
] as const;

// Data validation helpers
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Price parsing result
export interface ParsedPriceData {
  price: number | null;
  currency: string;
  unit: string;
  source: string;
  confidence: number; // 0-1 scale
}

// Futures contract options for API requests
export interface FuturesContractOptions {
  maxContracts?: number;
  minDaysToExpiry?: number;
  maxDaysToExpiry?: number;
  maxDaysToExpiration?: number;
  includeLiquidityMetrics?: boolean;
  validateExpiration?: boolean;
}

// Futures curve options for API requests  
export interface FuturesCurveOptions {
  maxContracts?: number;
  minDaysToExpiry?: number;
  maxDaysToExpiry?: number;
  includeLiquidityMetrics?: boolean;
  contractMonths?: string[];
  contractYear?: number;
  validateCurve?: boolean;
  includeAnalytics?: boolean;
} 