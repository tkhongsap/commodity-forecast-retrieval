# Task List: Market Consensus + Risk Adjustment Forecasting

## Relevant Files

- `src/services/yahoo-finance-service.ts` - Extend existing service to add futures contract data fetching methods
- `src/services/yahoo-finance-service.test.ts` - Unit tests for new futures functionality
- `src/services/forecast-service.ts` - Modify to implement hybrid forecasting logic with market consensus + risk adjustment
- `src/services/forecast-service.test.ts` - Unit tests for new forecasting approach
- `src/types/commodity.ts` - Add futures curve and risk adjustment data types
- `src/types/yahoo-finance.ts` - Add futures contract data type definitions
- `src/config/yahoo-finance.ts` - Add futures contract symbol mappings and configurations
- `src/utils/risk-analyzer.ts` - NEW - Risk assessment and adjustment logic
- `src/utils/risk-analyzer.test.ts` - Unit tests for risk analysis functionality
- `src/utils/futures-mapper.ts` - NEW - Map time horizons to futures contract symbols
- `src/utils/futures-mapper.test.ts` - Unit tests for futures mapping logic

### Notes

- Unit tests should typically be placed alongside the code files they are testing
- Use `npm test` to run all tests or `npx jest [path/to/test/file]` for specific test files
- Maintain backwards compatibility with existing forecast system during implementation
- Focus on crude oil (CL=F) only for this implementation

## Tasks

- [ ] 1.0 Futures Data Integration and Yahoo Finance Extension
  - [ ] 1.1 Research and verify Yahoo Finance futures contract symbols for crude oil (CLM25, CLU25, CLZ25, CLH26)
  - [ ] 1.2 Add getFuturesContract() method to yahoo-finance-service.ts for individual contract fetching
  - [ ] 1.3 Add getFuturesCurve() method to fetch multiple contracts for time horizon mapping
  - [ ] 1.4 Implement futures data validation and quality checks (liquidity, spread validation)
  - [ ] 1.5 Add futures data caching with 1-4 hour TTL using existing cache infrastructure
  - [ ] 1.6 Create comprehensive unit tests for all new futures fetching methods

- [ ] 2.0 Risk Analysis and AI Integration Module
  - [ ] 2.1 Create risk-analyzer.ts utility module for risk assessment logic
  - [ ] 2.2 Design single OpenAI query template covering all time horizons and risk factors
  - [ ] 2.3 Implement parseRiskFactors() method to extract risk adjustments from AI response
  - [ ] 2.4 Add risk quantification logic to convert AI analysis to percentage adjustments
  - [ ] 2.5 Implement confidence level assignment for risk assessments
  - [ ] 2.6 Add error handling and fallback for AI call failures
  - [ ] 2.7 Create unit tests for risk analysis parsing and adjustment calculations

- [ ] 3.0 Hybrid Forecasting Engine Implementation
  - [ ] 3.1 Create futures-mapper.ts to map forecast horizons (3,6,12,24 months) to contract symbols
  - [ ] 3.2 Modify forecast-service.ts to implement new generateMarketConsensusForecasts() method
  - [ ] 3.3 Implement baseline forecast extraction from futures curve data
  - [ ] 3.4 Add risk adjustment application logic to modify baseline forecasts
  - [ ] 3.5 Create combined forecast output with both market consensus and risk-adjusted prices
  - [ ] 3.6 Implement forecast uncertainty ranges and confidence intervals
  - [ ] 3.7 Add backwards compatibility mode to switch between old and new forecasting methods

- [ ] 4.0 Data Types and Configuration Updates
  - [ ] 4.1 Add FuturesContract, FuturesCurve, and RiskAdjustment types to commodity.ts
  - [ ] 4.2 Add YahooFinanceFuturesResponse interface to yahoo-finance.ts types
  - [ ] 4.3 Update existing ForecastData type to include market consensus baseline
  - [ ] 4.4 Add futures contract symbol mappings to yahoo-finance.ts config
  - [ ] 4.5 Add risk factor categories and impact ranges to configuration
  - [ ] 4.6 Update existing output formatter to display market consensus vs risk-adjusted forecasts

- [ ] 5.0 Testing, Validation and Performance Optimization
  - [ ] 5.1 Create integration tests for complete forecast generation flow
  - [ ] 5.2 Add performance benchmarks comparing old vs new forecasting speed
  - [ ] 5.3 Implement API cost tracking to verify 75% reduction achievement
  - [ ] 5.4 Add data quality validation for futures curve completeness
  - [ ] 5.5 Create error handling tests for futures data unavailability scenarios
  - [ ] 5.6 Add market hours handling for futures data availability
  - [ ] 5.7 Optimize caching strategy and measure cache hit rates
  - [ ] 5.8 Update existing end-to-end tests to work with new forecasting system