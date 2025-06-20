# Product Requirements Document: OpenAI API Commodity Forecast Test

## Introduction/Overview

This document outlines the requirements for developing a TypeScript test script that experiments with OpenAI's web search and function calling capabilities. The script will fetch and display crude oil price forecasts in an organized format to help developers understand how to integrate OpenAI API features into future applications.

The primary goal is to test the OpenAI API's ability to retrieve real-time commodity price data and generate forecasts using web search functionality, while presenting the results in both JSON and tabular formats.

## Goals

1. **API Learning**: Successfully implement OpenAI's web search and function calling features
2. **Data Retrieval**: Fetch current crude oil prices and generate forecasts for multiple time horizons
3. **Integration Testing**: Validate patterns that can be used in future application development
4. **Data Organization**: Present retrieved data in clean, structured formats suitable for analysis
5. **Source Validation**: Ensure all forecast data includes reliable source attribution

## User Stories

1. **Developer Learning**: As a developer, I want to experiment with OpenAI's web search API so that I can understand how to integrate it into future applications.

2. **Data Retrieval**: As a developer, I want to fetch current crude oil prices and forecasts so that I can see how the API handles real-time financial data.

3. **Format Validation**: As a developer, I want to see the results in both JSON and table formats so that I can understand different output options for future implementations.

4. **Source Tracking**: As a developer, I want to see the sources of forecast data so that I can validate the reliability of the information retrieved.

## Functional Requirements

1. **API Integration**: The script must successfully connect to the OpenAI API using credentials stored in a .env file.

2. **Commodity Focus**: The script must specifically target crude oil (WTI) with the symbol 'CL=F'.

3. **Current Price Retrieval**: The script must fetch and display the current crude oil price in USD per barrel.

4. **Multi-horizon Forecasting**: The script must generate forecasts for the following time periods:
   - 3-month outlook
   - 6-month outlook
   - 12-month outlook
   - 24-month outlook

5. **Comprehensive Data Points**: For each forecast period, the script must provide:
   - Current price
   - Forecasted price
   - Percentage change from current price
   - Date ranges for the forecast period
   - Confidence levels (when available)

6. **Dual Output Format**: The script must present results in both:
   - JSON format (structured data)
   - Table format (human-readable)

7. **File and Console Output**: The script must save results to a file and display them in the console.

8. **Source Attribution**: The script must include sources for all retrieved data and forecasts.

## Non-Goals (Out of Scope)

1. **Historical Data**: The script will not retrieve or analyze historical price data.
2. **Multiple Commodities**: Focus is exclusively on crude oil; other commodities are not included.
3. **Error Handling**: Comprehensive error handling is not required for this testing phase.
4. **Production-Ready Code**: This is a test script, not production-ready code.
5. **Real-time Updates**: The script will not provide continuous or real-time price updates.
6. **Advanced Analytics**: No complex statistical analysis or technical indicators.
7. **User Interface**: No graphical user interface or interactive elements.

## Design Considerations

- **TypeScript**: Use TypeScript for type safety and better development experience
- **Clean Output**: Ensure both JSON and table outputs are well-formatted and readable
- **Modular Structure**: Organize code in a way that demonstrates good integration patterns
- **Environment Variables**: Use .env file for secure API key management

## Technical Considerations

- **OpenAI API Integration**: Script must use the official OpenAI SDK/API
- **Environment Setup**: Requires OpenAI API key stored in .env file
- **TypeScript Runtime**: Ensure proper TypeScript compilation and execution
- **File System Access**: Script needs permission to write output files
- **Web Search Feature**: Must utilize OpenAI's web search functionality specifically
- **Function Calling**: Implement OpenAI's function calling capabilities for data retrieval

## Success Metrics

1. **API Call Success**: 100% successful connection and data retrieval from OpenAI API
2. **Data Completeness**: All required data points (current price, forecasts, changes, dates, confidence) are retrieved
3. **Source Attribution**: All data includes reliable source information
4. **Format Quality**: Both JSON and table outputs are clean, readable, and properly formatted
5. **Forecast Coverage**: All four time horizons (3, 6, 12, 24 months) are successfully generated
6. **Output Delivery**: Results are successfully saved to file and displayed in console

## Open Questions

1. What specific file format should be used for saving results (e.g., .json, .txt, .csv)?
2. Should the script include timestamps for when the data was retrieved?
3. Are there any specific table formatting preferences (e.g., borders, alignment)?
4. Should the script include any basic validation of the retrieved price data?
5. What should be the behavior if some forecast horizons are unavailable? 