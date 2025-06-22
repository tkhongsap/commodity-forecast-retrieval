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

This is an OpenAI Commodity Forecast API Test project demonstrating advanced forecasting capabilities. The project has evolved from simple web search to a sophisticated **Market Consensus + Risk Adjustment Forecasting System** that achieves **75% API cost reduction** through intelligent data source selection and hybrid forecasting methodologies.

## Core Architecture

### Main Application Flow
- `src/commodity-forecast-test.ts` - Main entry point orchestrating the hybrid forecasting process
- Primary data flow: Yahoo Finance → Futures Analysis → Risk Assessment → Hybrid Forecasting → Output

### Key Architectural Layers

1. **Data Sources Layer**
   - `src/services/yahoo-finance-service.ts` - Primary real-time futures and spot price data
   - `src/utils/yahoo-finance-parser.ts` - Specialized futures contract and term structure parsing
   - Web search fallback for risk factor analysis
   - Comprehensive caching and rate limiting (5-minute TTL)

2. **Forecasting Engine Layer**
   - `src/services/forecast-service.ts` - Hybrid forecasting engine combining market consensus with risk adjustments
   - `src/utils/futures-mapper.ts` - Futures curve construction and term structure analysis
   - `src/utils/risk-analyzer.ts` - Multi-factor risk assessment and adjustment calculation
   - Market consensus baseline extraction from futures curves

3. **Risk Analysis Layer**
   - **Risk Categories**: Geopolitical, Supply/Demand, Economic, Weather, Regulatory
   - **Time Scaling**: Adjustments based on forecast horizon (3-24 months)
   - **Confidence Intervals**: Statistically-derived uncertainty quantification
   - **Risk Combination Rules**: Maximum 35% total adjustment with diversification factors

4. **Validation & Quality Layer**
   - `src/utils/price-validator.ts` - Multi-layer price and forecast validation
   - `src/utils/data-validator.ts` - Comprehensive data integrity checks
   - Cross-validation between spot prices and futures curves
   - Futures contract expiration and arbitrage validation

5. **Caching & Performance Layer**
   - `src/utils/cache-manager.ts` - Multi-tier caching strategy
   - **Cache TTL Strategy**: Spot (1min) → Front Month (5min) → Long Term (4hrs)
   - Performance benchmarking for 75% cost reduction validation
   - Circuit breaker patterns for API reliability

6. **Configuration & Types Layer**
   - `src/config/yahoo-finance.ts` - Comprehensive futures market configuration
   - `src/types/commodity.ts` - Enhanced interfaces for futures contracts and risk assessments
   - `src/types/yahoo-finance.ts` - Yahoo Finance API data structures
   - `src/utils/error-utils.ts` - Consolidated error handling utilities

### Hybrid Forecasting Data Flow
1. **Futures Data Acquisition** → Yahoo Finance Service (futures curves, term structure)
2. **Market Consensus Baseline** → Extract implied forward prices from futures contracts
3. **Risk Factor Analysis** → Multi-category risk assessment with confidence scoring
4. **Risk Adjustment Application** → Time-scaled, weighted risk modifications
5. **Confidence Interval Calculation** → Statistical uncertainty quantification
6. **Output Generation** → Structured forecasts with market consensus vs. risk-adjusted prices

## Development Guidelines

### Core Coding Rules (from `ai-dev-tasks/coding-rules.md`)
- Iterate on existing code patterns rather than creating new ones
- Keep files under 200-300 lines, refactor when larger
- Avoid duplication - check for existing similar functionality first
- Focus only on areas relevant to the task
- Write thorough tests for all major functionality
- Never mock data for dev/prod environments (tests only)
- Prefer simple solutions and maintain clean organization

### TypeScript Configuration
- Strict mode enabled with comprehensive type safety
- ts-node configured with relaxed checking for development
- Optional chaining and null checks required for all data access
- Interfaces enforce proper typing for futures contracts and risk assessments

## Key Commands

### Development
- `npm start` - Run the hybrid commodity forecast system
- `npm run dev` - Run in watch mode with auto-restart
- `npm run build` - Build TypeScript files to dist/
- `npm test` - Run comprehensive Jest test suite
- `npm run test:watch` - Run tests in watch mode

### Testing Commands
All test files follow a consistent `.test.ts` naming pattern:
- `src/services/yahoo-finance-service.test.ts` - Service layer tests
- `src/utils/*.test.ts` - Unit tests for utility modules (cache, logger, price-validator, etc.)
- Jest configuration supports comprehensive test coverage

### Environment Setup
Requires `.env` file with:
```
OPENAI_API_KEY=your_openai_api_key_here
```
**Critical**: API key must have access to `gpt-4o-search-preview` model

## Market Consensus + Risk Forecasting System

### Key Features (75% Cost Reduction Achievement)
- **Hybrid Methodology**: Combines futures market consensus with AI-driven risk analysis
- **Multi-Horizon Forecasting**: 3, 6, 12, 24-month forecasts with confidence intervals
- **Risk Factor Integration**: 5 categories of risk with time-scaling and combination rules
- **Performance Optimization**: Intelligent caching reduces API calls by 75%
- **Futures Curve Analysis**: Term structure analysis with contango/backwardation detection

### Risk Factor Categories
1. **Geopolitical**: Max 15% impact (sanctions, conflicts, political instability)
2. **Supply/Demand**: Max 25% impact (production cuts, demand spikes, inventory levels)
3. **Economic**: Max 20% impact (interest rates, inflation, currency fluctuations)
4. **Weather**: Max 30% impact (extreme weather, natural disasters, climate change)
5. **Regulatory**: Max 18% impact (policy changes, environmental regulations)

### Futures Contract Processing
- **Contract Month Mapping**: Standard CME/NYMEX contract codes (F=Jan, G=Feb, etc.)
- **Expiration Handling**: Business day rules for contract rollovers
- **Curve Construction**: Interpolation and extrapolation for missing maturities
- **Arbitrage Detection**: Validation of price relationships across the curve
