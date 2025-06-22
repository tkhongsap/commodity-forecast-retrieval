# PRD: Market Consensus + Risk Adjustment Forecasting

## Introduction/Overview

The current commodity forecasting system uses 4 separate OpenAI web search calls to generate forecasts for different time horizons (3, 6, 12, 24 months), resulting in high API costs and inconsistent results. This feature will implement a hybrid approach that leverages oil futures market data as the baseline consensus forecast, combined with a single strategic AI call for geopolitical risk assessment.

The goal is to create a more cost-effective, faster, and potentially more accurate forecasting system by utilizing professional traders' market consensus (futures curve) as the foundation, rather than attempting to forecast prices from scratch.

## Goals

1. **Reduce OpenAI API costs by 75%** (from 4 calls to 1 call per forecast)
2. **Improve forecast reliability** by using market consensus as baseline
3. **Maintain geopolitical awareness** through strategic AI risk overlay
4. **Increase forecast generation speed** by reducing API dependency
5. **Create scalable architecture** for future multi-commodity expansion

## User Stories

1. **As a commodity analyst**, I want to get oil price forecasts that incorporate both market consensus and geopolitical risks, so that I can make informed investment decisions without expensive API costs.

2. **As a researcher**, I want to understand both the market baseline expectation and the potential risk factors that could disrupt it, so that I can assess forecast uncertainty.

3. **As a developer**, I want a cost-effective forecasting system that doesn't rely heavily on expensive AI calls, so that the application can scale without prohibitive costs.

4. **As a user**, I want faster forecast generation that still captures major market disruption risks, so that I can get timely insights without long wait times.

## Functional Requirements

### Core Forecasting Engine
1. **The system must fetch oil futures contract data** from Yahoo Finance for multiple expiration dates (3, 6, 12, 24 months ahead)
2. **The system must extract market consensus prices** from futures contracts as baseline forecasts
3. **The system must perform a single strategic OpenAI API call** to analyze geopolitical and market risks
4. **The system must apply risk adjustments** to baseline futures prices based on AI analysis
5. **The system must generate final forecasts** with both baseline and risk-adjusted prices

### Risk Analysis Module
6. **The system must identify key risk factors** including: geopolitical tensions, OPEC decisions, supply disruptions, economic recession risks, and regulatory changes
7. **The system must quantify risk impact** as percentage adjustments to baseline prices
8. **The system must assign confidence levels** to risk assessments
9. **The system must provide risk factor explanations** for forecast adjustments

### Data Integration
10. **The system must extend the existing Yahoo Finance service** to support futures contract data fetching
11. **The system must maintain backwards compatibility** with existing commodity data structures
12. **The system must cache futures curve data** with appropriate TTL (1-4 hours)
13. **The system must validate futures data quality** before using for forecasts

### Output and Display
14. **The system must display both market consensus and risk-adjusted forecasts** in a clear comparison format
15. **The system must show risk factors** that influenced each time horizon
16. **The system must provide confidence intervals** or uncertainty ranges for forecasts
17. **The system must maintain existing output formats** (JSON, table, console) for compatibility

## Non-Goals (Out of Scope)

1. **Multi-commodity support** - This version focuses only on crude oil (CL=F)
2. **Real-time futures tracking** - Forecasts are generated on-demand, not continuously updated
3. **Advanced statistical modeling** - Using market consensus, not building complex mathematical models
4. **Historical backtesting** - No validation against historical forecast accuracy
5. **User interface changes** - Maintaining existing CLI/console interface
6. **Custom risk factor weighting** - Using AI-determined risk adjustments only

## Technical Considerations

### Integration Points
- **Extend `yahoo-finance-service.ts`** to add futures contract data fetching methods
- **Modify `forecast-service.ts`** to implement hybrid forecasting logic
- **Update `commodity.ts` types** to include futures curve and risk adjustment data
- **Maintain existing error handling** and logging infrastructure

### Data Sources
- **Yahoo Finance Futures**: CLM25, CLU25, CLZ25, CLH26 (March, June, December 2025, March 2026)
- **Single OpenAI Call**: Risk analysis covering all time horizons in one query
- **Existing price data**: Current spot prices from existing Yahoo Finance integration

### Performance Requirements
- **Futures data caching**: 1-4 hour TTL to balance freshness and API efficiency
- **Single AI call timeout**: 30 seconds maximum
- **Total forecast generation**: Under 45 seconds (vs current ~2 minutes)

### Dependencies
- Existing Yahoo Finance service infrastructure
- OpenAI API client (already implemented)
- Current caching and error handling systems

## Success Metrics

### Primary Metrics
1. **API Cost Reduction**: 75% reduction in OpenAI API calls (4 → 1 per forecast run)
2. **Performance Improvement**: 50%+ faster forecast generation time
3. **System Reliability**: Maintain 95%+ successful forecast generation rate

### Secondary Metrics
4. **User Adoption**: Continued usage without complaints about forecast quality
5. **Error Rate**: Less than 5% failure rate for futures data fetching
6. **Cache Efficiency**: 80%+ cache hit rate for futures data

### Quality Metrics
7. **Forecast Completeness**: Generate forecasts for all 4 time horizons (3, 6, 12, 24 months)
8. **Risk Factor Coverage**: Identify at least 3-5 relevant risk factors per forecast
9. **Market Alignment**: Baseline forecasts align with actual futures market prices

## Open Questions

1. **Futures Contract Mapping**: Need to verify exact Yahoo Finance symbols for oil futures contracts and their expiration mapping to our time horizons
2. **Risk Quantification**: Determine optimal format for AI to return risk impact percentages (±X% or absolute dollar amounts)
3. **Market Hours Handling**: How to handle forecasts when futures markets are closed vs. open
4. **Futures Curve Validation**: Define acceptable quality thresholds for futures data (minimum liquidity, maximum spread)
5. **Error Fallback**: If futures data is unavailable, should we fall back to current web search method or return error?

## Implementation Priority

**Phase 1 (High Priority)**:
- Futures data integration
- Basic risk adjustment logic
- Single AI call implementation

**Phase 2 (Medium Priority)**:
- Enhanced error handling
- Caching optimization
- Output format improvements

**Future Enhancements**:
- Multi-commodity expansion
- Advanced risk modeling
- Historical performance tracking