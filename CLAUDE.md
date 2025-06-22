# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Memory Instructions

Please remember: When the user says "context priming" or "/context-priming", execute:
```
read README.md, CLAUDE.md, ai_docs/*, and run git ls-files to understand this codebase.
```

## Custom Commands

### /context-priming
When you type `/context-priming` or mention "context priming", I will:
- Read README.md
- Read CLAUDE.md
- Read all files in ai_docs/* 
- Run git ls-files to understand the codebase structure

This helps me quickly understand the project context and structure.

## Project Context

This is a Commodity Forecasting System that has evolved from an OpenAI web search demonstration to a professional-grade forecasting platform. The system integrates Yahoo Finance as the primary data source with OpenAI as a strategic fallback, featuring comprehensive service-oriented architecture, caching, validation, and multi-horizon forecasting capabilities.

**Current State**: Recently underwent major Phase 1 refactoring (1,186 → 260 lines in main file) with service extraction. Next phase involves implementing Market Consensus + Risk Adjustment Forecasting using futures curve data to reduce API costs by 75%.

## Core Architecture

### Service-Oriented Design (Post-Refactoring)
The system uses a clean service-oriented architecture with dedicated modules:

- `src/commodity-forecast-test.ts` - **Main orchestrator** (260 lines, down from 1,186)
- `src/services/web-search-service.ts` - **OpenAI integration** with retry logic (230 lines)
- `src/services/price-data-service.ts` - **Yahoo Finance integration & price parsing** (387 lines)  
- `src/services/forecast-service.ts` - **Multi-horizon forecast generation** (565 lines)
- `src/services/yahoo-finance-service.ts` - **Core Yahoo Finance API client** (860 lines)

### Data Flow Architecture
```
Current Price Request
├── Yahoo Finance Service (Primary)
│   ├── HTTP Client → Cache Check → API Call
│   ├── Price Validation → Confidence Scoring
│   └── Structured Response
├── OpenAI Fallback (If Yahoo fails)
│   ├── Web Search Service → Retry Logic
│   ├── Price Parsing → Validation
│   └── Fallback Response
└── Output → JSON + Human-readable formats

Forecast Generation  
├── Multi-Horizon Queries (3, 6, 12, 24 months)
├── Forecast Service → OpenAI Web Search
├── Price Parsing → Validation → Confidence
└── Comprehensive Analysis Output
```

### Key Architectural Principles
1. **Primary/Fallback Pattern**: Yahoo Finance primary, OpenAI strategic fallback
2. **Service Isolation**: Each service handles one responsibility 
3. **Comprehensive Validation**: Multi-layer validation with confidence scoring
4. **Graceful Degradation**: System continues operating with cached/fallback data
5. **Professional Logging**: Structured JSON logging with source attribution

## Development Guidelines

### Core Coding Rules (from `.cursor/rules/coding-rules.mdc`)
- **Iterate existing patterns** rather than creating new ones
- **Keep files under 200-300 lines** - refactor when larger (main file was 1,186 → 260)
- **Check for existing functionality** before duplicating code
- **Focus only on relevant areas** to the current task
- **Write thorough tests** for all major functionality  
- **Never mock data** for dev/prod environments (tests only)
- **Prefer simple solutions** and maintain clean organization

### Service Architecture Principles
- **One responsibility per service** - each module handles specific functionality
- **Factory pattern usage** - `createServiceName()` functions for instantiation
- **Dependency injection** - services receive dependencies in constructor
- **Interface-driven** - comprehensive TypeScript interfaces in `src/types/`
- **Error boundary patterns** - each service handles its own error cases

### TypeScript Configuration
- **Relaxed strict mode** for development efficiency (exactOptionalPropertyTypes: false)
- **Compilation target** optimized for Node.js compatibility
- **Path resolution** configured for clean imports

## Key Commands

### Development Commands
- `npm start` - **Run complete forecast system** (tests + price fetch + forecasts + output)
- `npm run dev` - **Watch mode** with auto-restart on file changes
- `npm run build` - **Compile TypeScript** to dist/ directory
- `npm test` - **Run Jest test suite** for all utilities and services
- `npm run test:watch` - **Interactive test runner** with file watching

### Environment Requirements
Create `.env` file in project root:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```
**Critical**: API key must have access to `gpt-4o-search-preview` model

## Testing Strategy

### Test Organization
- **Utilities**: `src/utils/*.test.ts` - Cache manager, logger, price validator  
- **Services**: `src/services/*.test.ts` - Yahoo Finance service (comprehensive suite)
- **Integration**: Built-in connectivity tests run with each forecast execution
- **Configuration**: Jest with ts-jest preset, configured in package.json

### Testing Patterns
- **External API mocking** for Yahoo Finance and OpenAI integration
- **Edge case coverage** including network failures, invalid responses, parsing errors
- **Real-time validation** during each `npm start` execution

## Implementation Patterns

### Primary/Fallback Pattern
- **Yahoo Finance Primary**: Real-time quote data with caching (5-min TTL)
- **OpenAI Strategic Fallback**: Web search when Yahoo Finance fails
- **Automatic Switching**: Seamless fallback with retry logic and exponential backoff
- **Data Validation**: Both sources validated with commodity-specific rules ($10-$200/barrel)

### Service Communication Patterns
```typescript
// Factory pattern for service creation
const webSearchService = createWebSearchService(openAIClient);
const priceDataService = createPriceDataService(webSearchService);
const forecastService = createForecastService(webSearchService);

// Dependency injection
class PriceDataService {
  constructor(private webSearchService: WebSearchService) {}
}
```

### Error Handling Architecture
- **Multi-layer validation** with confidence scoring at each step
- **Graceful degradation** using cached data when all sources fail  
- **Context preservation** through structured error objects
- **Source attribution** for all data points and error conditions

## Project Organization

### Directory Structure
- `src/services/` - **Service layer** (web-search, price-data, forecast, yahoo-finance)
- `src/utils/` - **Utility modules** (cache, logger, validator, formatter, http-client)
- `src/types/` - **TypeScript interfaces** (commodity, yahoo-finance data structures)
- `src/config/` - **Configuration** (Yahoo Finance settings, validation rules)
- `output/` - **Generated reports** (timestamped JSON and human-readable files)
- `tasks/` - **Project planning** (PRDs, task lists, implementation tracking)

### Task Management System

**Current Implementation Status**:
- ✅ **Phase 1 Complete**: Codebase refactoring and service extraction  
- ✅ **Phase 2 Complete**: Market Consensus + Risk Adjustment Forecasting (75% cost reduction achieved)
- 📋 **Documentation**: `tasks/prd-market-consensus-risk-forecasting.md` 
- 📝 **Task Tracking**: `tasks/tasks-prd-market-consensus-risk-forecasting.md` (all tasks marked complete)

**Task Processing Used**:
- ✅ Followed `ai-dev-tasks/process-tasks-agents.md` for sub-agent delegation
- ✅ Used parallel research + sequential implementation approach
- ✅ All 32 tasks completed with checkbox format after comprehensive testing

### Implementation Highlights

**System Architecture**:
- **No Historical Data**: Uses only forward-looking futures contracts for market consensus
- **Risk Categories**: Geopolitical, Supply/Demand, Economic, Weather, Regulatory
- **Time Scaling**: Risk impact increases with forecast horizon uncertainty
- **Cache Strategy**: Multi-tier TTL (1min-4hr) optimized for different contract timeframes

**Data Types Added**:
- `MarketConsensusForcast` - Futures-based baseline forecasts
- `RiskAdjustment` - AI risk factors with percentage impact calculations
- `FuturesCurve` - Yahoo Finance futures contract collection
- `YahooFinanceFuturesResponse` - API response types for futures data

**Testing Coverage**:
- Integration tests validating complete forecast pipeline
- Performance benchmarks confirming 75% cost reduction
- Error handling validation for API failures and fallback scenarios  
- Accuracy validation for forecast confidence intervals

### Factory Patterns
```typescript
// Singleton-style getters for shared instances
const logger = getLogger();
const cacheManager = getCacheManager();

// Factory functions for new instances  
const priceValidator = createPriceValidator(commodityConfig);
const yahooService = getYahooFinanceService(); // singleton
```

## Market Consensus + Risk Forecasting System ✅ COMPLETED

**Objective**: ✅ **ACHIEVED** - Replaced expensive 4-call OpenAI forecasting with futures curve + 1 strategic AI call
**Impact**: ✅ **75% API cost reduction achieved** (2 calls vs 8) while maintaining forecast quality
**Implementation**: ✅ **All 32 sub-tasks completed** across 5 phases 
**Architecture**: ✅ **Fully implemented** - Yahoo Finance futures data + OpenAI risk overlay

### Implemented Features
- **Hybrid Forecasting Engine** - Market consensus baseline + AI risk adjustments
- **Futures Contract Mapping** - CLZ23 format with quarterly contract selection
- **Risk Analysis Module** - 5 risk categories with time-scaled impact assessment
- **Comprehensive Testing** - Integration, performance, accuracy, and error handling tests
- **Backwards Compatibility** - Toggle between new hybrid and original web search methods

### Key Services Added
- **RiskAnalyzer** (`src/utils/risk-analyzer.ts`) - AI-powered risk assessment
- **FuturesMapper** (`src/utils/futures-mapper.ts`) - Time horizon to contract mapping
- **Enhanced ForecastService** - Hybrid market consensus + risk adjustment methods
- **Extended YahooFinanceService** - Futures curve data fetching capabilities

### Configuration Updates
- **FUTURES_CONFIG** - Contract symbols, expiration rules, caching strategies
- **RISK_FACTOR_CONFIG** - Risk categories, impact ranges, time scaling factors
- **FORECASTING_CONFIG** - Method selection, cost targets, performance metrics

### Cost Optimization Achieved
- **Traditional Method**: 8 OpenAI calls (4 forecasts + 4 risk analyses) = ~$0.20 per forecast
- **New Hybrid Method**: 2 calls (1 futures fetch + 1 comprehensive risk analysis) = ~$0.05 per forecast
- **Cost Reduction**: 75% savings achieved as targeted