/**
 * Yahoo Finance Configuration Module
 * 
 * Centralizes all API settings, endpoints, commodity symbols, and configuration
 * parameters for Yahoo Finance integration. This module provides type-safe
 * configuration objects with sensible defaults aligned with PRD requirements.
 * 
 * @author Yahoo Finance Integration Module
 * @version 1.0.0
 */

/**
 * API Endpoint Configuration
 */
export const API_ENDPOINTS = {
  /** Base URL for Yahoo Finance API */
  BASE_URL: 'https://query1.finance.yahoo.com',
  /** Chart data endpoint for historical and real-time data */
  CHART: '/v8/finance/chart',
  /** Quote endpoint for current market data */
  QUOTE: '/v7/finance/quote',
  /** Search endpoint for symbol lookup */
  SEARCH: '/v1/finance/search',
  /** Spark chart endpoint for mini charts */
  SPARK: '/v7/finance/spark',
  /** Options endpoint for derivatives data */
  OPTIONS: '/v7/finance/options',
  /** Screener endpoint for market screening */
  SCREENER: '/v1/finance/screener'
} as const;

/**
 * HTTP Request Configuration
 */
export const HTTP_CONFIG = {
  /** Default request timeout in milliseconds */
  TIMEOUT: 15000,
  /** User agent string for requests */
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  /** Default headers for all requests */
  DEFAULT_HEADERS: {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  },
  /** Keep-alive timeout for connections */
  KEEP_ALIVE_TIMEOUT: 30000
} as const;

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT_CONFIG = {
  /** Maximum requests per minute */
  REQUESTS_PER_MINUTE: 120,
  /** Maximum requests per hour */
  REQUESTS_PER_HOUR: 2000,
  /** Maximum requests per day */
  REQUESTS_PER_DAY: 20000,
  /** Burst allowance for rapid requests */
  BURST_LIMIT: 10,
  /** Cooldown period after rate limit hit (milliseconds) */
  COOLDOWN_PERIOD: 60000,
  /** Enable rate limiting */
  ENABLED: true
} as const;

/**
 * Retry Configuration
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  MAX_RETRIES: 3,
  /** Base delay between retries (milliseconds) */
  BASE_DELAY: 1000,
  /** Maximum delay between retries (milliseconds) */
  MAX_DELAY: 10000,
  /** Exponential backoff multiplier */
  BACKOFF_MULTIPLIER: 2,
  /** Add jitter to prevent thundering herd */
  ENABLE_JITTER: true,
  /** HTTP status codes that should trigger retries */
  RETRYABLE_STATUS_CODES: [429, 500, 502, 503, 504, 520, 521, 522, 524],
  /** Error types that should trigger retries */
  RETRYABLE_ERRORS: ['TIMEOUT', 'NETWORK_ERROR', 'DNS_ERROR', 'CONNECTION_RESET']
} as const;

/**
 * Cache Configuration (5-minute TTL as specified in PRD)
 */
export const CACHE_CONFIG = {
  /** Enable caching */
  ENABLED: true,
  /** Default cache TTL in milliseconds (5 minutes as per PRD) */
  DEFAULT_TTL: 5 * 60 * 1000,
  /** Cache TTL for different data types */
  TTL_BY_TYPE: {
    /** Real-time quotes (5 minutes) */
    QUOTES: 5 * 60 * 1000,
    /** Historical data (30 minutes) */
    HISTORICAL: 30 * 60 * 1000,
    /** Market status (1 minute) */
    MARKET_STATUS: 1 * 60 * 1000,
    /** Symbol metadata (24 hours) */
    METADATA: 24 * 60 * 60 * 1000,
    /** Search results (15 minutes) */
    SEARCH: 15 * 60 * 1000
  },
  /** Maximum cache size in MB */
  MAX_SIZE_MB: 100,
  /** Cache cleanup interval (milliseconds) */
  CLEANUP_INTERVAL: 10 * 60 * 1000,
  /** Cache key prefix */
  KEY_PREFIX: 'yahoo_finance:'
} as const;

/**
 * Commodity Symbol Mappings
 * Maps commodity names to their Yahoo Finance symbols
 */
export const COMMODITY_SYMBOLS = {
  // Energy Commodities
  CRUDE_OIL_WTI: {
    symbol: 'CL=F',
    name: 'Crude Oil WTI',
    exchange: 'NYMEX',
    currency: 'USD',
    unit: 'USD per barrel',
    contractType: 'future' as const,
    category: 'energy',
    isActive: true,
    multiplier: 1000,
    tickSize: 0.01,
    description: 'West Texas Intermediate Crude Oil Futures'
  },
  CRUDE_OIL_BRENT: {
    symbol: 'BZ=F',
    name: 'Brent Crude Oil',
    exchange: 'ICE',
    currency: 'USD',
    unit: 'USD per barrel',
    contractType: 'future' as const,
    category: 'energy',
    isActive: true,
    multiplier: 1000,
    tickSize: 0.01,
    description: 'Brent Crude Oil Futures'
  },
  NATURAL_GAS: {
    symbol: 'NG=F',
    name: 'Natural Gas',
    exchange: 'NYMEX',
    currency: 'USD',
    unit: 'USD per MMBtu',
    contractType: 'future' as const,
    category: 'energy',
    isActive: true,
    multiplier: 10000,
    tickSize: 0.001,
    description: 'Natural Gas Futures'
  },
  HEATING_OIL: {
    symbol: 'HO=F',
    name: 'Heating Oil',
    exchange: 'NYMEX',
    currency: 'USD',
    unit: 'USD per gallon',
    contractType: 'future' as const,
    category: 'energy',
    isActive: true,
    multiplier: 42000,
    tickSize: 0.0001,
    description: 'Heating Oil Futures'
  },
  RBOB_GASOLINE: {
    symbol: 'RB=F',
    name: 'RBOB Gasoline',
    exchange: 'NYMEX',
    currency: 'USD',
    unit: 'USD per gallon',
    contractType: 'future' as const,
    category: 'energy',
    isActive: true,
    multiplier: 42000,
    tickSize: 0.0001,
    description: 'RBOB Gasoline Futures'
  },

  // Precious Metals
  GOLD: {
    symbol: 'GC=F',
    name: 'Gold',
    exchange: 'COMEX',
    currency: 'USD',
    unit: 'USD per troy ounce',
    contractType: 'future' as const,
    category: 'metals',
    isActive: true,
    multiplier: 100,
    tickSize: 0.10,
    description: 'Gold Futures'
  },
  SILVER: {
    symbol: 'SI=F',
    name: 'Silver',
    exchange: 'COMEX',
    currency: 'USD',
    unit: 'USD per troy ounce',
    contractType: 'future' as const,
    category: 'metals',
    isActive: true,
    multiplier: 5000,
    tickSize: 0.005,
    description: 'Silver Futures'
  },
  COPPER: {
    symbol: 'HG=F',
    name: 'Copper',
    exchange: 'COMEX',
    currency: 'USD',
    unit: 'USD per pound',
    contractType: 'future' as const,
    category: 'metals',
    isActive: true,
    multiplier: 25000,
    tickSize: 0.0005,
    description: 'Copper Futures'
  },
  PLATINUM: {
    symbol: 'PL=F',
    name: 'Platinum',
    exchange: 'NYMEX',
    currency: 'USD',
    unit: 'USD per troy ounce',
    contractType: 'future' as const,
    category: 'metals',
    isActive: true,
    multiplier: 50,
    tickSize: 0.10,
    description: 'Platinum Futures'
  },
  PALLADIUM: {
    symbol: 'PA=F',
    name: 'Palladium',
    exchange: 'NYMEX',
    currency: 'USD',
    unit: 'USD per troy ounce',
    contractType: 'future' as const,
    category: 'metals',
    isActive: true,
    multiplier: 100,
    tickSize: 0.05,
    description: 'Palladium Futures'
  },

  // Agricultural Commodities
  CORN: {
    symbol: 'ZC=F',
    name: 'Corn',
    exchange: 'CBOT',
    currency: 'USD',
    unit: 'USD per bushel',
    contractType: 'future' as const,
    category: 'agriculture',
    isActive: true,
    multiplier: 5000,
    tickSize: 0.0025,
    description: 'Corn Futures'
  },
  WHEAT: {
    symbol: 'ZW=F',
    name: 'Wheat',
    exchange: 'CBOT',
    currency: 'USD',
    unit: 'USD per bushel',
    contractType: 'future' as const,
    category: 'agriculture',
    isActive: true,
    multiplier: 5000,
    tickSize: 0.0025,
    description: 'Wheat Futures'
  },
  SOYBEANS: {
    symbol: 'ZS=F',
    name: 'Soybeans',
    exchange: 'CBOT',
    currency: 'USD',
    unit: 'USD per bushel',
    contractType: 'future' as const,
    category: 'agriculture',
    isActive: true,
    multiplier: 5000,
    tickSize: 0.0025,
    description: 'Soybean Futures'
  },
  COFFEE: {
    symbol: 'KC=F',
    name: 'Coffee',
    exchange: 'ICE',
    currency: 'USD',
    unit: 'USD per pound',
    contractType: 'future' as const,
    category: 'agriculture',
    isActive: true,
    multiplier: 37500,
    tickSize: 0.0005,
    description: 'Coffee C Futures'
  },
  SUGAR: {
    symbol: 'SB=F',
    name: 'Sugar',
    exchange: 'ICE',
    currency: 'USD',
    unit: 'USD per pound',
    contractType: 'future' as const,
    category: 'agriculture',
    isActive: true,
    multiplier: 112000,
    tickSize: 0.0001,
    description: 'Sugar No. 11 Futures'
  },
  COTTON: {
    symbol: 'CT=F',
    name: 'Cotton',
    exchange: 'ICE',
    currency: 'USD',
    unit: 'USD per pound',
    contractType: 'future' as const,
    category: 'agriculture',
    isActive: true,
    multiplier: 50000,
    tickSize: 0.0001,
    description: 'Cotton No. 2 Futures'
  },
  LIVE_CATTLE: {
    symbol: 'LE=F',
    name: 'Live Cattle',
    exchange: 'CME',
    currency: 'USD',
    unit: 'USD per pound',
    contractType: 'future' as const,
    category: 'agriculture',
    isActive: true,
    multiplier: 40000,
    tickSize: 0.00025,
    description: 'Live Cattle Futures'
  },
  LEAN_HOGS: {
    symbol: 'HE=F',
    name: 'Lean Hogs',
    exchange: 'CME',
    currency: 'USD',
    unit: 'USD per pound',
    contractType: 'future' as const,
    category: 'agriculture',
    isActive: true,
    multiplier: 40000,
    tickSize: 0.00025,
    description: 'Lean Hog Futures'
  }
} as const;

/**
 * Data Validation Rules for Different Commodities
 */
export const VALIDATION_RULES = {
  PRICE_RANGES: {
    // Energy commodities (USD)
    CRUDE_OIL_WTI: { min: 0, max: 200, warningThresholds: { low: 30, high: 150 } },
    CRUDE_OIL_BRENT: { min: 0, max: 200, warningThresholds: { low: 30, high: 150 } },
    NATURAL_GAS: { min: 0, max: 20, warningThresholds: { low: 1, high: 15 } },
    HEATING_OIL: { min: 0, max: 10, warningThresholds: { low: 1, high: 8 } },
    RBOB_GASOLINE: { min: 0, max: 8, warningThresholds: { low: 1, high: 6 } },

    // Precious metals (USD per troy ounce)
    GOLD: { min: 1000, max: 5000, warningThresholds: { low: 1500, high: 4000 } },
    SILVER: { min: 10, max: 100, warningThresholds: { low: 15, high: 80 } },
    COPPER: { min: 1, max: 10, warningThresholds: { low: 2, high: 8 } },
    PLATINUM: { min: 500, max: 3000, warningThresholds: { low: 800, high: 2500 } },
    PALLADIUM: { min: 1000, max: 5000, warningThresholds: { low: 1500, high: 4000 } },

    // Agricultural commodities (USD per bushel/pound)
    CORN: { min: 200, max: 1000, warningThresholds: { low: 300, high: 800 } },
    WHEAT: { min: 300, max: 1500, warningThresholds: { low: 400, high: 1200 } },
    SOYBEANS: { min: 500, max: 2000, warningThresholds: { low: 700, high: 1700 } },
    COFFEE: { min: 50, max: 350, warningThresholds: { low: 80, high: 300 } },
    SUGAR: { min: 5, max: 50, warningThresholds: { low: 8, high: 40 } },
    COTTON: { min: 30, max: 150, warningThresholds: { low: 50, high: 120 } },
    LIVE_CATTLE: { min: 80, max: 200, warningThresholds: { low: 100, high: 180 } },
    LEAN_HOGS: { min: 40, max: 150, warningThresholds: { low: 60, high: 130 } }
  },
  
  /** Volume validation thresholds */
  VOLUME_THRESHOLDS: {
    MIN_DAILY_VOLUME: 1000,
    SUSPICIOUS_VOLUME_MULTIPLIER: 10,
    ZERO_VOLUME_WARNING: true
  },

  /** Data freshness requirements */
  DATA_FRESHNESS: {
    /** Maximum age for real-time data (minutes) */
    MAX_REALTIME_AGE_MINUTES: 15,
    /** Maximum age for historical data (hours) */
    MAX_HISTORICAL_AGE_HOURS: 24,
    /** Warn if data is older than threshold */
    STALENESS_WARNING_MINUTES: 30
  },

  /** Required fields for different data types */
  REQUIRED_FIELDS: {
    QUOTE: ['symbol', 'regularMarketPrice', 'regularMarketTime'],
    HISTORICAL: ['timestamp', 'open', 'high', 'low', 'close'],
    METADATA: ['symbol', 'currency', 'exchangeName', 'instrumentType']
  }
} as const;

/**
 * Time Interval and Range Configurations
 */
export const TIME_CONFIG = {
  /** Valid time intervals for data requests */
  INTERVALS: {
    '1m': { label: '1 minute', seconds: 60 },
    '2m': { label: '2 minutes', seconds: 120 },
    '5m': { label: '5 minutes', seconds: 300 },
    '15m': { label: '15 minutes', seconds: 900 },
    '30m': { label: '30 minutes', seconds: 1800 },
    '60m': { label: '1 hour', seconds: 3600 },
    '90m': { label: '90 minutes', seconds: 5400 },
    '1h': { label: '1 hour', seconds: 3600 },
    '1d': { label: '1 day', seconds: 86400 },
    '5d': { label: '5 days', seconds: 432000 },
    '1wk': { label: '1 week', seconds: 604800 },
    '1mo': { label: '1 month', seconds: 2629746 },
    '3mo': { label: '3 months', seconds: 7889238 }
  },

  /** Valid time ranges for data requests */
  RANGES: {
    '1d': { label: '1 day', days: 1 },
    '5d': { label: '5 days', days: 5 },
    '1mo': { label: '1 month', days: 30 },
    '3mo': { label: '3 months', days: 90 },
    '6mo': { label: '6 months', days: 180 },
    '1y': { label: '1 year', days: 365 },
    '2y': { label: '2 years', days: 730 },
    '5y': { label: '5 years', days: 1825 },
    '10y': { label: '10 years', days: 3650 },
    'ytd': { label: 'Year to date', days: null },
    'max': { label: 'Maximum available', days: null }
  },

  /** Default configurations for different use cases */
  DEFAULTS: {
    REALTIME_INTERVAL: '1m',
    DAILY_INTERVAL: '1d',
    WEEKLY_INTERVAL: '1wk',
    MONTHLY_INTERVAL: '1mo',
    DEFAULT_RANGE: '1mo',
    FORECAST_RANGE: '2y'
  }
} as const;

/**
 * Error Handling Configuration
 */
export const ERROR_CONFIG = {
  /** Error classification */
  ERROR_TYPES: {
    NETWORK: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT_ERROR',
    RATE_LIMIT: 'RATE_LIMIT_ERROR',
    INVALID_SYMBOL: 'INVALID_SYMBOL_ERROR',
    DATA_UNAVAILABLE: 'DATA_UNAVAILABLE_ERROR',
    PARSING: 'DATA_PARSING_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    API_ERROR: 'API_ERROR',
    AUTHENTICATION: 'AUTH_ERROR'
  },

  /** Error recovery strategies */
  RECOVERY_STRATEGIES: {
    RETRY: 'retry',
    FALLBACK: 'fallback',
    CACHE: 'use_cache',
    SKIP: 'skip_request',
    ALERT: 'alert_user'
  },

  /** Circuit breaker configuration */
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RECOVERY_TIMEOUT: 60000,
    MONITOR_TIMEOUT: 10000,
    ENABLED: true
  }
} as const;

/**
 * Market Hours Configuration
 */
export const MARKET_HOURS = {
  /** NYMEX (Energy and metals) */
  NYMEX: {
    timezone: 'America/New_York',
    regular: { open: '09:00', close: '17:00' },
    electronic: { open: '18:00', close: '17:00+1' },
    sunday: { open: '18:00', close: '17:00+1' }
  },
  /** COMEX (Precious metals) */
  COMEX: {
    timezone: 'America/New_York',
    regular: { open: '08:20', close: '13:30' },
    electronic: { open: '18:00', close: '17:00+1' },
    sunday: { open: '18:00', close: '17:00+1' }
  },
  /** CBOT (Agricultural) */
  CBOT: {
    timezone: 'America/Chicago',
    regular: { open: '09:30', close: '14:20' },
    electronic: { open: '20:00', close: '08:45+1' },
    sunday: { open: '20:00', close: '08:45+1' }
  },
  /** ICE (Coffee, Sugar, etc.) */
  ICE: {
    timezone: 'America/New_York',
    regular: { open: '04:00', close: '14:00' },
    electronic: { open: '20:00', close: '18:00+1' },
    sunday: { open: '20:00', close: '18:00+1' }
  }
} as const;

/**
 * Default Configuration Object
 * Combines all configuration sections with sensible defaults
 */
export const DEFAULT_YAHOO_FINANCE_CONFIG = {
  api: {
    baseUrl: API_ENDPOINTS.BASE_URL,
    timeout: HTTP_CONFIG.TIMEOUT,
    userAgent: HTTP_CONFIG.USER_AGENT,
    headers: HTTP_CONFIG.DEFAULT_HEADERS
  },
  cache: {
    enabled: CACHE_CONFIG.ENABLED,
    defaultTtl: CACHE_CONFIG.DEFAULT_TTL,
    maxSizeMb: CACHE_CONFIG.MAX_SIZE_MB,
    keyPrefix: CACHE_CONFIG.KEY_PREFIX
  },
  rateLimit: {
    enabled: RATE_LIMIT_CONFIG.ENABLED,
    requestsPerMinute: RATE_LIMIT_CONFIG.REQUESTS_PER_MINUTE,
    requestsPerHour: RATE_LIMIT_CONFIG.REQUESTS_PER_HOUR,
    burstLimit: RATE_LIMIT_CONFIG.BURST_LIMIT
  },
  retry: {
    maxRetries: RETRY_CONFIG.MAX_RETRIES,
    baseDelay: RETRY_CONFIG.BASE_DELAY,
    maxDelay: RETRY_CONFIG.MAX_DELAY,
    backoffMultiplier: RETRY_CONFIG.BACKOFF_MULTIPLIER,
    enableJitter: RETRY_CONFIG.ENABLE_JITTER
  },
  validation: {
    enablePriceValidation: true,
    enableVolumeValidation: true,
    enableFreshnessCheck: true,
    strictMode: false
  },
  defaults: {
    interval: TIME_CONFIG.DEFAULTS.DAILY_INTERVAL,
    range: TIME_CONFIG.DEFAULTS.DEFAULT_RANGE,
    includePremiumData: false,
    includeExtendedHours: false
  }
} as const;

/**
 * Utility Functions for Configuration
 */

/**
 * Get commodity configuration by symbol
 */
export function getCommodityConfig(symbol: string) {
  return Object.values(COMMODITY_SYMBOLS).find(config => config.symbol === symbol);
}

/**
 * Get commodity configuration by name
 */
export function getCommodityByName(name: string) {
  return Object.entries(COMMODITY_SYMBOLS).find(([, config]) => 
    config.name.toLowerCase().includes(name.toLowerCase())
  )?.[1];
}

/**
 * Get all commodities by category
 */
export function getCommoditiesByCategory(category: string) {
  return Object.values(COMMODITY_SYMBOLS).filter(config => config.category === category);
}

/**
 * Get validation rules for a commodity
 */
export function getValidationRules(commodityKey: keyof typeof COMMODITY_SYMBOLS) {
  return VALIDATION_RULES.PRICE_RANGES[commodityKey];
}

/**
 * Build complete API URL
 */
export function buildApiUrl(endpoint: string, symbol?: string): string {
  const baseUrl = API_ENDPOINTS.BASE_URL + endpoint;
  return symbol ? `${baseUrl}/${symbol}` : baseUrl;
}

/**
 * Type definitions for configuration
 */
export type CommoditySymbolKey = keyof typeof COMMODITY_SYMBOLS;
export type CommodityConfig = typeof COMMODITY_SYMBOLS[CommoditySymbolKey];
export type TimeInterval = keyof typeof TIME_CONFIG.INTERVALS;
export type TimeRange = keyof typeof TIME_CONFIG.RANGES;
export type CommodityCategory = 'energy' | 'metals' | 'agriculture';
export type ContractType = 'spot' | 'future' | 'option';

/**
 * Export configuration for easy access
 */
export default {
  endpoints: API_ENDPOINTS,
  http: HTTP_CONFIG,
  rateLimit: RATE_LIMIT_CONFIG,
  retry: RETRY_CONFIG,
  cache: CACHE_CONFIG,
  commodities: COMMODITY_SYMBOLS,
  validation: VALIDATION_RULES,
  time: TIME_CONFIG,
  errors: ERROR_CONFIG,
  marketHours: MARKET_HOURS,
  defaults: DEFAULT_YAHOO_FINANCE_CONFIG
} as const;