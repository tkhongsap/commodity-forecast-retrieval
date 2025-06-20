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
  type: 'commodity';
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