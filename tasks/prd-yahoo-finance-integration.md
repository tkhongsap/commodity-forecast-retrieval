# Product Requirements Document: Yahoo Finance API Integration for Consistent Price Retrieval

## Introduction/Overview

The existing TypeScript commodity forecasting application currently relies on OpenAI web search for retrieving current commodity prices. However, this approach has resulted in inconsistent and sometimes incorrect price data when compared to credible financial sources like Yahoo Finance. This document outlines the requirements for integrating Yahoo Finance API as the primary data source for current price retrieval, with OpenAI web search as a fallback mechanism.

The goal is to ensure consistent, accurate, and reliable current price data for commodity forecasting, specifically starting with crude oil (CL=F), while maintaining compatibility with the existing forecast functionality.

## Goals

1. **Improve Price Accuracy**: Achieve 99% accurate current price retrieval using Yahoo Finance API as the primary data source
2. **Ensure Data Consistency**: Eliminate price discrepancies by using a single, credible financial data provider
3. **Implement Robust Fallback**: Maintain system reliability with automatic fallback to OpenAI web search when Yahoo Finance fails
4. **Enable Extensibility**: Design the integration to support additional commodity symbols beyond crude oil in the future
5. **Enhance Data Transparency**: Provide clear logging and tracking of data sources used for each price retrieval
6. **Optimize Performance**: Implement caching to reduce API calls and improve response times
7. **Maintain Compatibility**: Ensure seamless integration with existing forecast generation and analysis functionality

## User Stories

### Primary User Stories
1. **As a forecast system user**, I want to receive accurate current prices from Yahoo Finance so that my commodity forecasts are based on reliable data.

2. **As a system administrator**, I want automatic fallback to OpenAI web search when Yahoo Finance fails so that the system remains operational even during API outages.

3. **As a developer**, I want clear logging of which data source was used for each price retrieval so that I can monitor system performance and data quality.

4. **As a data analyst**, I want cached price data to improve system performance and reduce redundant API calls within reasonable time intervals.

5. **As a system user**, I want the system to validate Yahoo Finance prices against reasonable ranges so that obviously incorrect data is detected and handled appropriately.

### Secondary User Stories
1. **As a future developer**, I want the Yahoo Finance integration to be extensible so that additional commodity symbols can be easily added later.

2. **As a system operator**, I want comprehensive error handling and logging when both Yahoo Finance and OpenAI fallback fail so that I can troubleshoot issues effectively.

## Functional Requirements

### Primary Data Source Integration
1. **R1**: The system MUST integrate Yahoo Finance API as the primary data source for current commodity prices.
2. **R2**: The system MUST retrieve current prices for crude oil using the symbol "CL=F" from Yahoo Finance.
3. **R3**: The system MUST validate that Yahoo Finance API responses contain valid price data before processing.
4. **R4**: The system MUST handle Yahoo Finance API rate limiting and connection timeouts gracefully.

### Fallback Mechanism
5. **R5**: The system MUST automatically attempt OpenAI web search when Yahoo Finance API fails or returns invalid data.
6. **R6**: The system MUST try Yahoo Finance first on every price retrieval request, not just during initialization.
7. **R7**: The system MUST complete the entire price retrieval process within 30 seconds, including fallback attempts.

### Data Processing and Validation
8. **R8**: The system MUST validate Yahoo Finance prices against reasonable ranges (e.g., $10-$200 per barrel for crude oil).
9. **R9**: The system MUST cross-reference Yahoo Finance data format with existing `CommodityData` interface structure.
10. **R10**: The system MUST maintain the same data output format to ensure compatibility with existing forecast functionality.
11. **R11**: The system MUST handle cases where Yahoo Finance returns data in different formats or units.

### Caching Implementation
12. **R12**: The system MUST cache Yahoo Finance API responses for a configurable time period (default: 5 minutes).
13. **R13**: The system MUST use cached data when available and not expired to reduce API calls.
14. **R14**: The system MUST invalidate cache entries when they exceed the configured expiration time.
15. **R15**: The system MUST allow cache bypass for real-time price requirements.

### Logging and Monitoring
16. **R16**: The system MUST log which data source (Yahoo Finance or OpenAI) was used for each price retrieval.
17. **R17**: The system MUST log all API failures, including error messages and timestamps.
18. **R18**: The system MUST track and log cache hit/miss statistics.
19. **R19**: The system MUST maintain data retrieval success/failure metrics for monitoring purposes.

### Error Handling
20. **R20**: The system MUST display clear error messages when both Yahoo Finance and OpenAI fallback fail.
21. **R21**: The system MUST log detailed error information for debugging when data retrieval fails completely.
22. **R22**: The system MUST continue operating with the last successfully cached price when all data sources fail (with appropriate warnings).

### Configuration and Extensibility
23. **R23**: The system MUST support configurable commodity symbols through a configuration object or interface.
24. **R24**: The system MUST allow easy addition of new commodity symbols without code restructuring.
25. **R25**: The system MUST support configurable cache expiration times.
26. **R26**: The system MUST maintain separation between Yahoo Finance integration logic and existing forecast logic.

## Non-Goals (Out of Scope)

1. **Historical Data**: This integration will NOT include OHLC (Open, High, Low, Close) data - only current price retrieval is required.
2. **Multiple Data Providers**: Will NOT integrate additional financial data providers beyond Yahoo Finance and the existing OpenAI fallback.
3. **Real-time Streaming**: Will NOT implement real-time price streaming or WebSocket connections.
4. **Advanced Analytics**: Will NOT add new financial analysis features beyond current price retrieval.
5. **User Interface Changes**: Will NOT modify existing console output formats or add new UI components.
6. **Database Integration**: Will NOT implement persistent storage for price history.
7. **Authentication Systems**: Will NOT add user authentication or API key management beyond what's required for Yahoo Finance.
8. **Multiple Commodities**: Initial implementation will NOT support multiple commodities simultaneously - focus only on crude oil (CL=F).

## Technical Considerations

### TypeScript Integration
- **Integration Point**: Modify the `fetchCurrentCrudeOilPrice()` function in `/src/commodity-forecast-test.ts` to use Yahoo Finance API first
- **Interface Compatibility**: Ensure Yahoo Finance response maps to existing `WebSearchResult` and `CommodityData` interfaces
- **Type Safety**: Add proper TypeScript interfaces for Yahoo Finance API responses
- **Error Handling**: Implement TypeScript-friendly error handling with proper type guards

### API Integration Architecture
- **HTTP Client**: Use a reliable HTTP client library (axios or node-fetch) for Yahoo Finance API calls
- **Response Parsing**: Create dedicated parser functions for Yahoo Finance data format
- **Fallback Logic**: Implement clean separation between primary and fallback data retrieval methods
- **Cache Implementation**: Use in-memory caching with TTL (Time To Live) functionality

### Data Flow Integration
1. **Current Flow**: `fetchCurrentCrudeOilPrice()` → `performWebSearch()` → `parsePriceFromSearchResult()`
2. **New Flow**: `fetchCurrentCrudeOilPrice()` → `fetchFromYahooFinance()` → (fallback to) `performWebSearch()` → `parseYahooFinanceData()` or `parsePriceFromSearchResult()`

### Configuration Management
- **Symbol Configuration**: Extend `CRUDE_OIL_CONFIG` to include Yahoo Finance specific settings
- **API Configuration**: Add Yahoo Finance API endpoint and parameters configuration
- **Cache Configuration**: Add configurable cache settings with reasonable defaults

### Dependencies
- **New Dependencies**: May require adding Yahoo Finance API client library or HTTP client
- **Existing Dependencies**: Must maintain compatibility with current OpenAI integration
- **Environment Variables**: May require new environment variables for Yahoo Finance API configuration

## Success Metrics

### Quantitative Metrics
1. **Price Accuracy**: Achieve 99% success rate in price retrieval from either Yahoo Finance or OpenAI fallback
2. **Data Consistency**: Eliminate price discrepancies greater than 2% when compared to Yahoo Finance reference data
3. **Response Time**: Maintain total price retrieval time under 10 seconds (Yahoo Finance + fallback if needed)
4. **Cache Performance**: Achieve 60% cache hit rate during normal operation
5. **Fallback Usage**: Yahoo Finance should be the primary source for 95% of successful price retrievals

### Qualitative Metrics
1. **Code Quality**: Integration should not increase complexity of existing forecast functionality
2. **Maintainability**: New code should follow existing TypeScript patterns and conventions
3. **Extensibility**: Adding new commodity symbols should require minimal code changes
4. **Reliability**: System should handle API failures gracefully without affecting forecast generation
5. **Transparency**: Data source tracking should provide clear audit trail for price data origins

### Acceptance Criteria
1. **Core Functionality**: All existing forecast functionality continues to work without modification
2. **Primary Source**: Yahoo Finance is attempted first for every price retrieval request
3. **Fallback Reliability**: OpenAI web search fallback activates automatically when Yahoo Finance fails
4. **Data Validation**: Price data is validated for reasonableness before being used in forecasts
5. **Logging Completeness**: All price retrieval attempts are logged with source, timestamp, and success/failure status
6. **Cache Functionality**: Repeated requests within cache period return cached data without additional API calls
7. **Error Handling**: System provides informative error messages when all data sources fail
8. **Configuration**: Commodity symbols and cache settings are easily configurable

## Open Questions

### Technical Implementation
1. **Yahoo Finance API**: Which specific Yahoo Finance API endpoint should be used for real-time commodity prices?
2. **Authentication**: Does the chosen Yahoo Finance API require authentication keys or have usage limits?
3. **Data Format**: What is the exact JSON structure returned by Yahoo Finance for commodity data?
4. **Rate Limiting**: What are the rate limits for Yahoo Finance API and how should they be handled?

### Integration Specifics
1. **Cache Storage**: Should cache be in-memory only or should it support persistent storage options?
2. **Cache Key Strategy**: How should cache keys be structured to support multiple commodity symbols in the future?
3. **Fallback Timing**: What timeout threshold should trigger fallback to OpenAI web search?
4. **Error Classification**: Which Yahoo Finance API errors should trigger fallback vs. immediate failure?

### Configuration and Deployment
1. **Environment Setup**: What environment variables or configuration files are needed for Yahoo Finance integration?
2. **Testing Strategy**: How should the integration be tested without affecting production forecasts?
3. **Monitoring**: What additional monitoring or alerting should be implemented for the new data source?
4. **Documentation**: What documentation should be provided for future developers working on this integration?

### Future Considerations
1. **Symbol Expansion**: What is the timeline for adding additional commodity symbols beyond crude oil?
2. **Data Provider Expansion**: Are there plans to add additional data providers beyond Yahoo Finance?
3. **Historical Data**: When might historical data requirements be added to this integration?
4. **Performance Optimization**: What performance optimizations might be needed as usage scales?