# Yahoo Finance Service Module

This module provides a comprehensive service layer for fetching commodity price data from Yahoo Finance API with proper error handling, validation, and caching.

## Overview

The `YahooFinanceService` class is the core service that provides methods for:
- Fetching current prices for commodities
- Getting comprehensive quote data
- Retrieving historical chart data
- Market status information
- Multiple commodity price fetching

## Key Features

✅ **Type-Safe**: Built with TypeScript interfaces for complete type safety  
✅ **Error Handling**: Comprehensive error handling with specific error types  
✅ **Validation**: Data validation and price range checking  
✅ **Caching**: Built-in caching with configurable TTL  
✅ **Rate Limiting**: Integration with HTTP client rate limiting  
✅ **Logging**: Detailed logging for debugging and monitoring  
✅ **Extensible**: Designed to support multiple commodities  

## Quick Start

```typescript
import { getYahooFinanceService } from './services/yahoo-finance-service';
import { COMMODITY_SYMBOLS } from './config/yahoo-finance';

// Get singleton service instance
const service = getYahooFinanceService();

// Fetch current price for crude oil
const price = await service.getCurrentPrice(COMMODITY_SYMBOLS.CRUDE_OIL_WTI.symbol);
console.log(`Current WTI Crude Oil price: $${price.toFixed(2)}`);
```

## Main Methods

### `getCurrentPrice(symbol: string): Promise<number>`
Fetches the current market price for a given symbol.

### `getQuoteData(symbol: string, options?: QuoteOptions): Promise<YahooFinancePriceData>`
Gets comprehensive quote data including prices, volume, and market information.

### `getChartData(symbol: string, options?: ChartOptions): Promise<HistoricalData>`
Retrieves historical price data with configurable intervals and ranges.

### `getMultiplePrices(symbols: string[]): Promise<Map<string, number>>`
Efficiently fetches current prices for multiple commodities in parallel.

### `getMarketStatus(symbol: string): Promise<MarketStatus>`
Checks the current market status for a given symbol.

## Error Handling

The service uses a custom `YahooFinanceServiceException` class with specific error types:

- `INVALID_SYMBOL` - Invalid or malformed symbol
- `DATA_PARSING_ERROR` - Error parsing API response
- `VALIDATION_FAILED` - Data validation failure
- `NO_DATA_AVAILABLE` - No data returned from API
- `PRICE_OUT_OF_RANGE` - Price outside expected range
- `STALE_DATA` - Data is too old
- `MARKET_CLOSED` - Market is closed

## Configuration

The service integrates with the configuration module for:
- API endpoints and timeouts
- Rate limiting settings
- Cache configuration
- Validation rules
- Commodity symbol mappings

## Dependencies

- `../utils/http-client` - HTTP client for API requests
- `../config/yahoo-finance` - Configuration and commodity mappings
- `../types/yahoo-finance` - TypeScript interface definitions

## Usage Examples

See `../examples/yahoo-finance-service-example.ts` for comprehensive usage examples including:
- Basic price fetching
- Quote data retrieval
- Historical data analysis
- Error handling
- Cache management

## Cache Management

The service includes built-in caching with:
- 5-minute TTL for real-time quotes (configurable)
- 30-minute TTL for historical data
- Automatic cache cleanup
- Cache statistics and monitoring

## Validation Features

- Price range validation against expected commodity ranges
- Data freshness checking
- Volume validation
- Response structure validation
- Quality scoring for data reliability

## Integration Points

The service is designed to integrate with:
- HTTP client rate limiting
- Configuration management
- Logging systems
- Caching layers
- Error reporting systems

For detailed API documentation, see the TypeScript interfaces in `../types/yahoo-finance.ts`.