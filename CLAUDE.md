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

This is an OpenAI Commodity Forecast API Test project that demonstrates web search capabilities for fetching real-time crude oil prices and generating multi-horizon forecasts. The project has evolved to include a comprehensive Yahoo Finance integration with advanced caching, validation, logging, and error handling systems.

## Core Architecture

### Main Application Flow
- `src/commodity-forecast-test.ts` - Main entry point that orchestrates the entire forecast process
- Primary data flow: Yahoo Finance API → Cache → Validation → Logging → Output

### Key Architectural Layers

1. **Data Sources Layer**
   - `src/services/yahoo-finance-service.ts` - Primary real-time data source with HTTP client integration
   - OpenAI fallback system for when Yahoo Finance is unavailable
   - Automatic fallback with retry logic and exponential backoff

2. **Caching Layer** 
   - `src/utils/cache-manager.ts` - In-memory TTL-based caching system
   - Supports cache key strategies for multiple commodity symbols
   - Statistics tracking and cache warmup functionality

3. **Validation Layer**
   - `src/utils/price-validator.ts` - Commodity-specific price validation with confidence scoring
   - Cross-validation between multiple data sources
   - Range checking, currency validation, timestamp freshness validation

4. **Logging & Monitoring Layer**
   - `src/utils/logger.ts` - Structured JSON logging with data source attribution
   - Performance metrics, audit trails, and error classification
   - Configurable log levels and output formats

5. **Configuration Layer**
   - `src/config/yahoo-finance.ts` - Yahoo Finance API configuration and settings
   - `src/types/` - Comprehensive TypeScript interfaces for all data structures

6. **Utilities Layer**
   - `src/utils/formatter.ts` - Output formatting for JSON and human-readable reports
   - `src/utils/http-client.ts` - HTTP client with retry logic and error handling
   - `src/utils/error-*.ts` - Error monitoring, recovery, and logging utilities

### Data Flow Pattern
1. **Request** → Yahoo Finance Service (with caching check)
2. **Response** → Price Validator (commodity-specific rules)
3. **Validated Data** → Logger (structured logging with attribution)
4. **Processed Data** → Formatter (JSON + human-readable output)
5. **Fallback** → OpenAI web search if Yahoo Finance fails

## Development Guidelines

### Core Coding Rules (from `.cursor/rules/coding-rules.mdc`)
- Iterate on existing code patterns rather than creating new ones
- Keep files under 200-300 lines, refactor when larger
- Avoid duplication - check for existing similar functionality first
- Focus only on areas relevant to the task
- Write thorough tests for all major functionality
- Never mock data for dev/prod environments (tests only)
- Prefer simple solutions and maintain clean organization

### TypeScript Configuration
- Strict mode enabled with `exactOptionalPropertyTypes: true`
- All TypeScript strict flags enabled for maximum type safety
- When dealing with optional properties, use spread operators with conditional assignment

## Key Commands

### Development
- `npm start` - Run the commodity forecast test
- `npm run dev` - Run in watch mode with auto-restart
- `npm run build` - Build TypeScript files to dist/
- `npm test` - Run Jest tests  
- `npm run test:watch` - Run tests in watch mode

### Environment Setup
Requires `.env` file with:
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Testing Strategy

### Comprehensive Test Coverage
- All utility modules have corresponding `.test.ts` files
- Unit tests use Jest with ts-jest preset
- Extensive mocking for external API calls
- Test scenarios include edge cases, boundary conditions, and error states

### Test File Patterns
- `src/utils/*.test.ts` - Unit tests for utility modules
- `src/services/*.test.ts` - Service layer tests with mocked dependencies
- Test environment configured in `jest` section of package.json

## Important Implementation Details

### Error Handling Strategy
- Multi-layered error handling with classification systems
- Exponential backoff retry logic for transient failures
- Graceful degradation using cached data when all sources fail
- Comprehensive error logging with context preservation

### Data Validation Approach
- Commodity-specific validation rules (crude oil $10-$200/barrel)
- Confidence scoring based on data source quality
- Cross-validation between multiple data sources
- Real-time price range and timestamp validation

### Caching Strategy
- TTL-based in-memory caching (default: 5 minutes)
- Cache key strategies supporting multiple commodity symbols
- Cache statistics tracking for performance monitoring
- Cache warmup and invalidation capabilities

### Yahoo Finance Integration
- Primary data source with fallback to OpenAI web search
- HTTP client with timeout handling and retry logic
- Response parsing with confidence scoring
- Rate limiting awareness and backoff strategies

## File Organization Principles

- `src/types/` - All TypeScript interface definitions
- `src/services/` - External API integrations and business logic
- `src/utils/` - Pure utility functions and helper classes
- `src/config/` - Configuration files and constants
- `src/examples/` - Example usage and testing scripts
- `output/` - Generated forecast reports (timestamped files)
- `tasks/` - Project documentation and PRD specifications

## Task Management Integration

The project includes comprehensive task tracking:
- `tasks/tasks-prd-yahoo-finance-integration.md` - Detailed implementation tracking
- All major features (caching, validation, logging, fallback) are complete
- Task completion status tracked with checkbox format

## Common Patterns

### Singleton Pattern Usage
- Logger: `getLogger()` for singleton, `createLogger()` for new instances
- Cache Manager: Similar factory pattern with singleton option
- Price Validator: Centralized validation with configurable rules

### Configuration Pattern
- TypeScript interfaces for all configuration objects
- Default values with override capabilities
- Environment-specific settings support

### Error Classification
- Structured error objects with type, message, and stack information
- Error context preservation through the entire pipeline
- Detailed error attribution and source tracking