/**
 * Yahoo Finance API TypeScript Interface Definitions
 * 
 * These interfaces define the structure of responses from Yahoo Finance API endpoints,
 * specifically for commodity price data through the chart endpoint (v8/finance/chart).
 * 
 * Primary endpoint: https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}
 * 
 * @author Generated for Yahoo Finance Integration
 * @version 1.0.0
 */

/**
 * Trading period information for pre-market, regular, and post-market sessions
 */
export interface TradingPeriod {
  /** Timezone identifier (e.g., "EST") */
  timezone: string;
  /** Session start time as Unix timestamp */
  start: number;
  /** Session end time as Unix timestamp */
  end: number;
  /** GMT offset in seconds */
  gmtoffset: number;
}

/**
 * Current trading period information including all sessions
 */
export interface CurrentTradingPeriod {
  /** Pre-market trading session */
  pre: TradingPeriod;
  /** Regular trading session */
  regular: TradingPeriod;
  /** Post-market trading session */
  post: TradingPeriod;
}

/**
 * Metadata information for a financial instrument
 */
export interface YahooFinanceMeta {
  /** Base currency for the instrument */
  currency: string;
  /** Symbol identifier (e.g., "CL=F") */
  symbol: string;
  /** Exchange code (e.g., "NYM") */
  exchangeName: string;
  /** Full exchange name (e.g., "NY Mercantile") */
  fullExchangeName: string;
  /** Type of instrument (e.g., "FUTURE", "EQUITY") */
  instrumentType: string;
  /** First trade date as Unix timestamp */
  firstTradeDate: number;
  /** Last regular market time as Unix timestamp */
  regularMarketTime: number;
  /** Whether pre/post market data is available */
  hasPrePostMarketData: boolean;
  /** GMT offset in seconds */
  gmtoffset: number;
  /** Timezone identifier */
  timezone: string;
  /** Exchange timezone name */
  exchangeTimezoneName: string;
  /** Current regular market price */
  regularMarketPrice: number;
  /** 52-week high price */
  fiftyTwoWeekHigh: number;
  /** 52-week low price */
  fiftyTwoWeekLow: number;
  /** Today's high price */
  regularMarketDayHigh: number;
  /** Today's low price */
  regularMarketDayLow: number;
  /** Regular market trading volume */
  regularMarketVolume: number;
  /** Short display name of the instrument */
  shortName: string;
  /** Previous close price for chart comparison */
  chartPreviousClose: number;
  /** Number of decimal places for price display */
  priceHint: number;
  /** Current trading period information */
  currentTradingPeriod: CurrentTradingPeriod;
  /** Data granularity (e.g., "1d", "1h") */
  dataGranularity: string;
  /** Time range for the data (e.g., "1d", "5d") */
  range: string;
  /** Array of valid time ranges for this instrument */
  validRanges: string[];
  
  // Optional fields that may be present
  /** Long display name of the instrument */
  longName?: string;
  /** Market capitalization */
  marketCap?: number;
  /** Previous close price */
  previousClose?: number;
  /** Opening price */
  open?: number;
  /** Day's range string */
  dayRange?: string;
  /** 52-week range string */
  fiftyTwoWeekRange?: string;
  /** Average volume */
  averageVolume?: number;
  /** Average volume (10 days) */
  averageVolume10days?: number;
  /** Average volume (3 months) */
  averageVolume3months?: number;
  /** Regular market change amount */
  regularMarketChange?: number;
  /** Regular market change percentage */
  regularMarketChangePercent?: number;
  /** Regular market previous close */
  regularMarketPreviousClose?: number;
  /** Regular market open */
  regularMarketOpen?: number;
}

/**
 * Quote data containing OHLCV information
 */
export interface QuoteData {
  /** Array of high prices */
  high: (number | null)[];
  /** Array of opening prices */
  open: (number | null)[];
  /** Array of low prices */
  low: (number | null)[];
  /** Array of trading volumes */
  volume: (number | null)[];
  /** Array of closing prices */
  close: (number | null)[];
}

/**
 * Adjusted close price data
 */
export interface AdjCloseData {
  /** Array of adjusted closing prices */
  adjclose: (number | null)[];
}

/**
 * Technical indicators data structure
 */
export interface Indicators {
  /** Quote data with OHLCV arrays */
  quote: QuoteData[];
  /** Adjusted close data */
  adjclose: AdjCloseData[];
}

/**
 * Individual chart result for a single symbol
 */
export interface ChartResult {
  /** Metadata about the financial instrument */
  meta: YahooFinanceMeta;
  /** Array of Unix timestamps for data points */
  timestamp: number[];
  /** Technical indicators and price data */
  indicators: Indicators;
}

/**
 * Chart API response structure
 */
export interface ChartResponse {
  /** Array of chart results (typically one per symbol) */
  result: ChartResult[];
  /** Error information if request failed */
  error: YahooFinanceError | null;
}

/**
 * Complete Yahoo Finance API response
 */
export interface YahooFinanceResponse {
  /** Chart data response */
  chart: ChartResponse;
}

/**
 * Error response structure from Yahoo Finance API
 */
export interface YahooFinanceError {
  /** Error code */
  code: string;
  /** Error description */
  description: string;
}

/**
 * API request parameters for Yahoo Finance chart endpoint
 */
export interface YahooFinanceParams {
  /** Time interval for data points */
  interval?: '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo';
  /** Time range for historical data */
  range?: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max';
  /** Custom start date as Unix timestamp */
  period1?: number;
  /** Custom end date as Unix timestamp */
  period2?: number;
  /** Include pre-market data */
  includePrePost?: boolean;
  /** Events to include (dividends, splits) */
  events?: string;
}

/**
 * Processed price data extracted from Yahoo Finance response
 * Compatible with existing commodity data structures
 */
export interface YahooFinancePriceData {
  /** Current market price */
  currentPrice: number;
  /** Previous close price */
  previousClose: number;
  /** Today's opening price */
  openPrice: number;
  /** Today's high price */
  dayHigh: number;
  /** Today's low price */
  dayLow: number;
  /** Trading volume */
  volume: number;
  /** 52-week high */
  yearHigh: number;
  /** 52-week low */
  yearLow: number;
  /** Price change from previous close */
  priceChange: number;
  /** Percentage change from previous close */
  percentChange: number;
  /** Currency code */
  currency: string;
  /** Market symbol */
  symbol: string;
  /** Last update timestamp */
  lastUpdated: string;
  /** Exchange name */
  exchange: string;
  /** Instrument type */
  instrumentType: string;
}

/**
 * Historical price point for time series data
 */
export interface HistoricalPricePoint {
  /** Date as ISO string */
  date: string;
  /** Unix timestamp */
  timestamp: number;
  /** Opening price */
  open: number | null;
  /** High price */
  high: number | null;
  /** Low price */
  low: number | null;
  /** Closing price */
  close: number | null;
  /** Adjusted closing price */
  adjClose: number | null;
  /** Trading volume */
  volume: number | null;
}

/**
 * Complete historical data set
 */
export interface HistoricalData {
  /** Symbol identifier */
  symbol: string;
  /** Data interval */
  interval: string;
  /** Time range */
  range: string;
  /** Array of historical price points */
  prices: HistoricalPricePoint[];
  /** Metadata about the instrument */
  meta: YahooFinanceMeta;
}

/**
 * API client configuration
 */
export interface YahooFinanceConfig {
  /** Base URL for API requests */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Enable request caching */
  enableCache?: boolean;
  /** Cache duration in milliseconds */
  cacheDuration?: number;
}

/**
 * API client response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T | null;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Response timestamp */
  timestamp: string;
  /** Whether data came from cache */
  fromCache?: boolean;
}

/**
 * Rate limiting information
 */
export interface RateLimit {
  /** Requests per hour limit */
  requestsPerHour: number;
  /** Remaining requests in current hour */
  remaining: number;
  /** Reset time as Unix timestamp */
  resetTime: number;
  /** Whether rate limit is active */
  isLimited: boolean;
}

/**
 * Commodity-specific data mapping
 * Maps Yahoo Finance data to commodity analysis structure
 */
export interface CommodityMapping {
  /** Yahoo Finance symbol */
  yahooSymbol: string;
  /** Commodity display name */
  commodityName: string;
  /** Unit of measurement */
  unit: string;
  /** Currency code */
  currency: string;
  /** Exchange information */
  exchange: string;
  /** Contract type (spot, future, etc.) */
  contractType: 'spot' | 'future' | 'option';
  /** Whether the symbol is active */
  isActive: boolean;
}

/**
 * Market status information
 */
export interface MarketStatus {
  /** Market name */
  market: string;
  /** Current market state */
  status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET';
  /** Next market open time */
  nextOpen?: string;
  /** Next market close time */
  nextClose?: string;
  /** Timezone */
  timezone: string;
  /** Whether extended hours trading is available */
  extendedHours: boolean;
}

/**
 * Data validation result for Yahoo Finance responses
 */
export interface YahooFinanceValidation {
  /** Whether the response is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Missing required fields */
  missingFields: string[];
  /** Data quality score (0-1) */
  qualityScore: number;
}

// Export commonly used symbol mappings for commodities
export const COMMODITY_SYMBOLS = {
  CRUDE_OIL_WTI: 'CL=F',
  CRUDE_OIL_BRENT: 'BZ=F',
  NATURAL_GAS: 'NG=F',
  GOLD: 'GC=F',
  SILVER: 'SI=F',
  COPPER: 'HG=F',
  PLATINUM: 'PL=F',
  PALLADIUM: 'PA=F',
  CORN: 'ZC=F',
  WHEAT: 'ZW=F',
  SOYBEANS: 'ZS=F',
  COFFEE: 'KC=F',
  SUGAR: 'SB=F',
  COTTON: 'CT=F'
} as const;

// Export default configuration
export const DEFAULT_CONFIG: YahooFinanceConfig = {
  baseUrl: 'https://query1.finance.yahoo.com',
  timeout: 10000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  maxRetries: 3,
  retryDelay: 1000,
  enableCache: true,
  cacheDuration: 60000 // 1 minute
} as const;