## Relevant Files

- `src/commodity-forecast-test.ts` - Main TypeScript script that implements the OpenAI API integration and commodity forecasting functionality.
- `src/commodity-forecast-test.test.ts` - Unit tests for the main script.
- `src/types/commodity.ts` - TypeScript type definitions for commodity data structures.
- `src/utils/formatter.ts` - Utility functions for formatting output data (JSON and table formats).
- `src/utils/formatter.test.ts` - Unit tests for formatter utilities.
- `package.json` - Project dependencies and scripts configuration.
- `tsconfig.json` - TypeScript configuration file.
- `.env` - Environment variables (OpenAI API key).
- `output/forecast-results.json` - Output file for JSON formatted results.
- `output/forecast-results.txt` - Output file for table formatted results.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `commodity-forecast-test.ts` and `commodity-forecast-test.test.ts` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.
- The script should be executable via `npx ts-node src/commodity-forecast-test.ts` or after compilation.

## Tasks

- [x] 1.0 Project Setup and Environment Configuration
  - [x] 1.1 Initialize TypeScript project with package.json and dependencies (openai, dotenv, ts-node, @types/node)
  - [x] 1.2 Create tsconfig.json with appropriate TypeScript configuration for Node.js
  - [x] 1.3 Set up project directory structure (src/, output/, types/, utils/)
  - [x] 1.4 Configure .env file with OpenAI API key (following existing pattern)
  - [x] 1.5 Add npm scripts for running and testing the application

- [x] 2.0 OpenAI API Integration with Web Search Functionality
  - [x] 2.1 Set up OpenAI client initialization with environment variable loading
  - [x] 2.2 Implement basic web search function using chat.completions.create with gpt-4.1 model
  - [x] 2.3 Create reusable function for making web search queries with proper error handling
  - [x] 2.4 Test API connectivity and web search functionality with simple query

- [x] 3.0 Crude Oil Data Retrieval and Processing Logic
  - [x] 3.1 Create TypeScript interfaces for commodity data structure (CommodityData, ForecastData, SourceInfo)
  - [x] 3.2 Implement function to fetch current crude oil (CL=F) price via web search
  - [x] 3.3 Create parser to extract price data from web search results
  - [x] 3.4 Add data validation logic for retrieved price information
  - [x] 3.5 Implement source attribution extraction from search results

- [x] 4.0 Multi-Horizon Forecast Generation and Analysis
  - [x] 4.1 Create forecast query generator for 3-month outlook with specific prompts
  - [x] 4.2 Create forecast query generator for 6-month outlook with specific prompts
  - [x] 4.3 Create forecast query generator for 12-month outlook with specific prompts
  - [x] 4.4 Create forecast query generator for 24-month outlook with specific prompts
  - [x] 4.5 Implement percentage change calculation logic between current and forecasted prices
  - [x] 4.6 Extract confidence levels and date ranges from forecast results
  - [x] 4.7 Aggregate all forecast data into comprehensive data structure

- [x] 5.0 Output Formatting and File Management System
  - [x] 5.1 Create JSON formatter utility for structured data output
  - [x] 5.2 Create table formatter utility for human-readable console display
  - [x] 5.3 Implement file writing functionality for JSON output (output/forecast-results.json)
  - [x] 5.4 Implement file writing functionality for table output (output/forecast-results.txt)
  - [x] 5.5 Create console display function with formatted table output
  - [x] 5.6 Add timestamp functionality for data retrieval tracking
  - [x] 5.7 Integrate all output methods into main execution flow 