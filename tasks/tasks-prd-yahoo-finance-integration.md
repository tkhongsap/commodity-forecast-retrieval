## Relevant Files

- `src/commodity-forecast-test.ts` - Main application file containing `fetchCurrentCrudeOilPrice()` function that needs Yahoo Finance integration
- `src/types/commodity.ts` - Type definitions for CommodityData interfaces that need to be compatible with Yahoo Finance data
- `src/utils/formatter.ts` - Utility functions for output formatting and data tracking
- `src/config/yahoo-finance.ts` - New configuration file for Yahoo Finance API settings and commodity symbols
- `src/services/yahoo-finance-service.ts` - New service module for Yahoo Finance API integration with caching
- `src/services/yahoo-finance-service.test.ts` - Unit tests for Yahoo Finance service module
- `src/utils/price-validator.ts` - New utility module for price data validation and range checking
- `src/utils/price-validator.test.ts` - Unit tests for price validation module
- `src/utils/cache-manager.ts` - New utility module for implementing caching functionality with TTL
- `src/utils/cache-manager.test.ts` - Unit tests for cache manager module
- `src/utils/logger.ts` - New utility module for enhanced logging and monitoring of data sources
- `src/utils/logger.test.ts` - Unit tests for logger module
- `src/types/yahoo-finance.ts` - New TypeScript interfaces for Yahoo Finance API responses
- `package.json` - Dependencies file that may need new HTTP client libraries for Yahoo Finance API
- `.env` - Environment variables file for Yahoo Finance API configuration (if needed)

### Notes

- Unit tests should be created for all new modules and updated functionality
- The integration should maintain backward compatibility with existing forecast functionality
- Use `npm test` to run all tests after implementation
- Follow existing TypeScript patterns and error handling conventions

## Tasks

- [x] 1.0 Yahoo Finance API Integration and Core Service Implementation
  - [x] 1.1 Research and select Yahoo Finance API endpoint for real-time commodity prices (CL=F symbol)
  - [x] 1.2 Create TypeScript interfaces for Yahoo Finance API responses in `src/types/yahoo-finance.ts`
  - [x] 1.3 Create Yahoo Finance configuration module `src/config/yahoo-finance.ts` with API endpoints, symbols, and settings
  - [x] 1.4 Implement HTTP client setup with axios or node-fetch for Yahoo Finance API calls
  - [x] 1.5 Create core Yahoo Finance service `src/services/yahoo-finance-service.ts` with price fetching functionality
  - [x] 1.6 Implement response parser to convert Yahoo Finance data to `CommodityData` interface format
  - [x] 1.7 Add proper error handling for network failures, API rate limiting, and invalid responses
  - [x] 1.8 Create comprehensive unit tests `src/services/yahoo-finance-service.test.ts` with mocked API responses
  - [x] 1.9 Update package.json with required HTTP client dependencies
  - [x] 1.10 Integrate Yahoo Finance service into existing `fetchCurrentCrudeOilPrice()` function as primary data source

- [ ] 2.0 Caching System Implementation with TTL Support
  - [ ] 2.1 Design cache key strategy to support multiple commodity symbols (future extensibility)
  - [ ] 2.2 Create in-memory cache manager `src/utils/cache-manager.ts` with TTL (Time To Live) functionality
  - [ ] 2.3 Implement cache entry expiration logic with configurable timeout (default: 5 minutes)
  - [ ] 2.4 Add cache hit/miss statistics tracking for monitoring purposes
  - [ ] 2.5 Implement cache bypass option for real-time requirements when needed
  - [ ] 2.6 Create cache configuration interface with default settings in Yahoo Finance config
  - [ ] 2.7 Integrate caching logic into Yahoo Finance service to cache API responses
  - [ ] 2.8 Add cache invalidation functionality for manual cache clearing if needed
  - [ ] 2.9 Create comprehensive unit tests `src/utils/cache-manager.test.ts` with TTL expiration scenarios
  - [ ] 2.10 Implement cache warmup functionality to pre-populate cache during system startup

- [ ] 3.0 Data Validation and Price Range Checking System
  - [ ] 3.1 Create price validation utility `src/utils/price-validator.ts` with commodity-specific validation rules
  - [ ] 3.2 Implement crude oil price range validation ($10-$200 per barrel as reasonable bounds)
  - [ ] 3.3 Add currency and unit validation to ensure USD and "per barrel" consistency
  - [ ] 3.4 Create timestamp validation to detect stale data from Yahoo Finance responses
  - [ ] 3.5 Implement confidence scoring for Yahoo Finance data quality assessment
  - [ ] 3.6 Add cross-validation logic to compare Yahoo Finance and fallback data when both available
  - [ ] 3.7 Create validation result interface extending existing `ValidationResult` for comprehensive error reporting
  - [ ] 3.8 Integrate validation into Yahoo Finance service before returning data to main application
  - [ ] 3.9 Create comprehensive unit tests `src/utils/price-validator.test.ts` with edge cases and boundary testing
  - [ ] 3.10 Add validation configuration to support different commodities with varying price ranges

- [ ] 4.0 Enhanced Logging and Data Source Monitoring
  - [ ] 4.1 Create enhanced logging utility `src/utils/logger.ts` with structured logging for data source tracking
  - [ ] 4.2 Implement data source attribution logging (Yahoo Finance vs OpenAI fallback) for each price retrieval
  - [ ] 4.3 Add API failure logging with detailed error messages, timestamps, and failure reasons
  - [ ] 4.4 Create cache performance logging with hit/miss ratios and response time metrics
  - [ ] 4.5 Implement success/failure rate tracking for Yahoo Finance API calls with rolling statistics
  - [ ] 4.6 Add data retrieval audit trail with source, timestamp, price, and validation status
  - [ ] 4.7 Create log level configuration (debug, info, warn, error) for different deployment environments
  - [ ] 4.8 Implement structured log output format (JSON) for easy parsing and monitoring
  - [ ] 4.9 Create comprehensive unit tests `src/utils/logger.test.ts` with mock console output verification
  - [ ] 4.10 Integrate enhanced logging into all new modules and update existing `trackDataRetrieval` calls

- [ ] 5.0 Fallback Mechanism and Error Handling Integration
  - [ ] 5.1 Modify `fetchCurrentCrudeOilPrice()` function to attempt Yahoo Finance first, then OpenAI fallback
  - [ ] 5.2 Implement timeout handling (30 seconds total) for entire price retrieval process including fallback
  - [ ] 5.3 Create error classification system to determine when to trigger fallback vs immediate failure
  - [ ] 5.4 Add retry logic with exponential backoff for Yahoo Finance API transient failures
  - [ ] 5.5 Implement graceful degradation to use last cached price when all data sources fail
  - [ ] 5.6 Create comprehensive error messages for different failure scenarios (API down, invalid data, validation failed)
  - [ ] 5.7 Add fallback success/failure tracking to monitor primary vs secondary data source usage
  - [ ] 5.8 Ensure existing forecast functionality continues working unchanged with new data source priority
  - [ ] 5.9 Create integration tests to verify fallback mechanism works end-to-end
  - [ ] 5.10 Update existing error handling in `extractAndValidateCommodityData()` to work with Yahoo Finance validation