﻿# OpenAI Commodity Forecast API Test

A TypeScript project that demonstrates OpenAI's web search capabilities by fetching real-time crude oil prices and generating multi-horizon forecasts. This project showcases how to integrate OpenAI's `gpt-4.1` model with robust data validation and comprehensive output formatting.

## 🚀 Features

- **Real-time Price Fetching**: Get current crude oil (WTI) prices via OpenAI web search
- **Multi-Horizon Forecasting**: Generate forecasts for 3, 6, 12, and 24-month periods
- **Intelligent Data Validation**: Detect and prevent suspicious duplicate forecasts
- **Dual Output Format**: JSON and human-readable table formats
- **Comprehensive Error Handling**: Retry logic, timeouts, and exponential backoff
- **Source Attribution**: Track and display data sources for all information
- **Professional Logging**: Timestamped tracking of all operations

## 📋 Requirements

- **Node.js** (v16 or higher)
- **npm** (v7 or higher)
- **OpenAI API Key** with access to `gpt-4.1` model

## 🛠️ Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

**⚠️ Important**: Never commit your `.env` file. It's already included in `.gitignore`.

### 3. Verify Setup
```bash
npm start
```

## 📊 Usage

### Basic Usage
```bash
npm start
```

This will:
1. Test API connectivity
2. Fetch current crude oil prices
3. Generate multi-horizon forecasts
4. Validate data integrity
5. Output results in both console and files

### Output Files
The system generates timestamped files in the `output/` directory:
- `crude-oil-forecast-YYYY-MM-DD-HH-MM-SS.json` - Structured data
- `crude-oil-forecast-YYYY-MM-DD-HH-MM-SS.txt` - Human-readable report

## 🏗️ Project Structure

```
src/
├── commodity-forecast-test.ts    # Main application logic
├── types/
│   └── commodity.ts             # TypeScript interfaces
└── utils/
    └── formatter.ts             # Output formatting utilities
output/                          # Generated forecast reports
tasks/                          # Project documentation
├── prd-commodity-forecast-api-test.md
└── tasks-prd-commodity-forecast-api-test.md
```

## 🔧 Technical Details

### Core Components

1. **Web Search Engine** (`performWebSearch`)
   - Uses OpenAI's `gpt-4.1` model
   - Implements retry logic with exponential backoff
   - Handles timeouts and error recovery

2. **Price Data Parser** (`parsePriceFromSearchResult`)
   - Multiple regex patterns for price extraction
   - Confidence scoring based on context
   - Source attribution and validation

3. **Forecast Validation** (`validateForecastDiversity`)
   - Detects suspicious identical forecasts
   - Validates price variation across time horizons
   - Prevents output of unrealistic data

4. **Multi-Format Output** (`outputComprehensiveAnalysis`)
   - JSON format for programmatic use
   - Formatted tables for human readability
   - Comprehensive console logging

### Data Validation Features

The system includes robust validation to ensure data quality:

- **Duplicate Detection**: Identifies when all forecasts are suspiciously identical
- **Price Range Validation**: Ensures extracted prices are within reasonable oil price ranges
- **Confidence Scoring**: Assigns confidence levels based on parsing context
- **Source Verification**: Tracks and validates data sources
- **Horizon Logic**: Validates that longer-term forecasts show appropriate uncertainty

## 📈 Sample Output

```
════════════════════════════════════════════════════════════════════════════════
                    CRUDE OIL FORECAST ANALYSIS REPORT
════════════════════════════════════════════════════════════════════════════════

📊 CURRENT MARKET DATA
──────────────────────────────────────────────────
Commodity:     Crude Oil (WTI) (CL=F)
Current Price: $73.65 USD per barrel
Last Updated:  6/20/2025, 1:30:21 PM
Data Sources:  Web Search Result

🎯 MARKET ANALYSIS
──────────────────────────────────────────────────
Overall Trend:     NEUTRAL
Market Sentiment:  Mixed signals with uncertain price direction
Analysis Date:     6/20/2025, 1:31:05 PM

📈 MULTI-HORIZON PRICE FORECASTS
────────────────────────────────────────────────────────────────────────────────
┌─────────────┬─────────────┬─────────────┬──────────────┬─────────────┐
│   Horizon   │   Current   │  Forecast   │    Change    │ Confidence  │
│             │    Price    │    Price    │      %       │    Level    │
├─────────────┼─────────────┼─────────────┼──────────────┼─────────────┤
│ 3-month     │ $73.65      │ $76.50      │ +3.9%        │ 85%         │
│ 6-month     │ $73.65      │ $78.20      │ +6.2%        │ 70%         │
│ 12-month    │ $73.65      │ $82.15      │ +11.5%       │ 60%         │
└─────────────┴─────────────┴─────────────┴──────────────┴─────────────┘
```

## 🚨 Data Quality Assurance

The system prioritizes data integrity over generating results:

- **No Fake Data**: Returns empty results rather than bad data
- **Validation Warnings**: Alerts when forecast data appears unrealistic
- **Source Tracking**: All data includes source attribution
- **Confidence Scoring**: Quantifies reliability of extracted information

## 🛡️ Error Handling

- **API Connectivity**: Automatic retries with exponential backoff
- **Parsing Failures**: Graceful handling of unextractable data
- **Rate Limiting**: Respects API limits with appropriate delays
- **Timeout Protection**: Prevents hanging requests

## 🧪 Testing

The system includes built-in connectivity and functionality tests:

```bash
# Tests are automatically run with npm start
✅ API connectivity test
✅ Web search functionality test
✅ Data validation test
```

## 📝 Development Notes

### Key Design Decisions

1. **Data Integrity First**: Better to return no data than bad data
2. **Comprehensive Validation**: Multiple layers of data quality checks
3. **Professional Output**: Both machine-readable and human-readable formats
4. **Robust Error Handling**: Graceful degradation under various failure conditions

### Known Limitations

- Depends on OpenAI's web search quality and availability
- Forecast accuracy limited by available online sources
- Real-time data may have slight delays
- API rate limits may affect performance with frequent usage

## Contex Primiing
read README.md, CLAUDE.md, ai_docs/*, and run git ls-files to understand this codebase.


## 🤝 Contributing

This is a demonstration/testing project. Key areas for enhancement:

1. **Enhanced Parsing**: More sophisticated forecast extraction algorithms
2. **Additional Markets**: Support for other commodity types
3. **Historical Data**: Integration with historical price databases  
4. **Real-time Updates**: Continuous monitoring capabilities

## 📄 License

This project is for educational and testing purposes.

## 🆘 Support

For issues or questions about this implementation:

1. Check the console output for detailed error messages
2. Verify your OpenAI API key has access to `gpt-4.1`
3. Ensure your API account has sufficient credits
4. Review the validation warnings for data quality issues

---

**Note**: This project is designed for testing OpenAI's web search capabilities. Market forecasts are for demonstration purposes only and should not be used for actual trading or investment decisions.
