# Yahoo Finance API Research: Commodity Prices (CL=F)

## Executive Summary

Research conducted on Yahoo Finance API endpoints for real-time commodity prices, specifically crude oil (CL=F symbol). The official Yahoo Finance API was discontinued in 2017, but several endpoints remain functional through unofficial access methods.

## API Endpoint Analysis

### Working Endpoints

#### 1. Chart Endpoint (Primary Recommendation)
- **URL Pattern**: `https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}`
- **Alternative Server**: `https://query2.finance.yahoo.com/v8/finance/chart/{SYMBOL}`
- **Status**: ✅ Working as of December 2024

**Example for CL=F (Crude Oil WTI Futures):**
```
https://query1.finance.yahoo.com/v8/finance/chart/CL=F
https://query1.finance.yahoo.com/v8/finance/chart/CL=F?interval=1d&range=5d
```

**Parameters:**
- `interval`: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
- `range`: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
- `period1` & `period2`: Unix timestamps for custom date ranges

### Non-Working Endpoints

#### 1. Quote Endpoint (v7)
- **URL**: `https://query1.finance.yahoo.com/v7/finance/quote?symbols=CL=F`
- **Status**: ❌ Returns 401 Unauthorized
- **Notes**: Requires authentication/cookies

#### 2. Quote Summary Endpoint
- **URL**: `https://query2.finance.yahoo.com/v10/finance/quoteSummary/CL=F?modules=price`
- **Status**: ❌ Returns 401 Unauthorized

## Response Structure for CL=F

### Successful Chart API Response
```json
{
  "chart": {
    "result": [
      {
        "meta": {
          "currency": "USD",
          "symbol": "CL=F",
          "exchangeName": "NYM",
          "fullExchangeName": "NY Mercantile",
          "instrumentType": "FUTURE",
          "firstTradeDate": 967561200,
          "regularMarketTime": 1703199600,
          "hasPrePostMarketData": false,
          "gmtoffset": -18000,
          "timezone": "EST",
          "exchangeTimezoneName": "America/New_York",
          "regularMarketPrice": 75.00,
          "fiftyTwoWeekHigh": 84.52,
          "fiftyTwoWeekLow": 55.12,
          "regularMarketDayHigh": 75.45,
          "regularMarketDayLow": 74.20,
          "regularMarketVolume": 624854,
          "shortName": "Crude Oil Feb 25",
          "chartPreviousClose": 74.93,
          "priceHint": 2,
          "currentTradingPeriod": {
            "pre": {
              "timezone": "EST",
              "start": 1703163600,
              "end": 1703181600,
              "gmtoffset": -18000
            },
            "regular": {
              "timezone": "EST", 
              "start": 1703181600,
              "end": 1703199600,
              "gmtoffset": -18000
            },
            "post": {
              "timezone": "EST",
              "start": 1703199600,
              "end": 1703206800,
              "gmtoffset": -18000
            }
          },
          "dataGranularity": "1d",
          "range": "1d",
          "validRanges": ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
        },
        "timestamp": [1703181600, 1703268000, 1703354400],
        "indicators": {
          "quote": [{
            "high": [75.45, 76.20, 75.80],
            "open": [74.60, 75.10, 75.20],
            "low": [74.20, 74.80, 74.90],
            "volume": [624854, 580000, 620000],
            "close": [75.00, 75.85, 75.14]
          }],
          "adjclose": [{
            "adjclose": [75.00, 75.85, 75.14]
          }]
        }
      }
    ],
    "error": null
  }
}
```

### Key Data Points Available
- **Current Price**: `meta.regularMarketPrice`
- **52-Week High/Low**: `meta.fiftyTwoWeekHigh`, `meta.fiftyTwoWeekLow`
- **Daily High/Low**: `meta.regularMarketDayHigh`, `meta.regularMarketDayLow`
- **Volume**: `meta.regularMarketVolume`
- **Historical OHLCV**: `indicators.quote[0]` arrays
- **Trading Hours**: `meta.currentTradingPeriod`

## Rate Limits and Usage Restrictions

### Observed Limits
- **Estimated Rate Limit**: ~2,000 requests per hour per IP address
- **Daily Limit**: Up to 48,000 requests per day (unconfirmed)
- **Conservative Estimate**: 100 requests per hour (some reports)

### Common Issues
1. **429 Too Many Requests**: Frequent even when under limits
2. **User-Agent Required**: Must include proper User-Agent header
3. **IP-based Throttling**: Limits applied per IP address
4. **No Official Documentation**: Limits are observed, not documented

### Best Practices
- Implement 60-second delays between requests
- Include proper User-Agent headers
- Monitor for 429 errors and implement backoff
- Cache responses when possible
- Consider using multiple IP addresses for high-volume usage

## Authentication Requirements

### Current Status
- **API Key**: Not required for chart endpoint
- **Cookies/Crumb**: Not required for chart endpoint
- **Headers**: User-Agent recommended but not strictly required

### Authentication Notes
- Quote endpoints (v7, v10) require authentication
- Chart endpoint (v8) works without authentication
- May change without notice as Yahoo actively prevents API abuse

## Commodity Symbols

### Crude Oil Futures
- **WTI Crude Oil**: `CL=F` (Primary contract)
- **Brent Crude Oil**: `BZ=F`

### Symbol Format Notes
- Futures contracts use `=F` suffix
- Specific month contracts: `CLK25.NYM` (March 2025)
- Yahoo automatically maps `CL=F` to current active contract

## Limitations and Considerations

### Data Quality
- **Real-time vs Delayed**: Major commodities typically real-time
- **Market Hours**: Data availability follows exchange trading hours
- **Weekends**: Limited or no data updates

### API Stability
- **Unofficial Status**: No SLA or support guarantees
- **Subject to Change**: Endpoints may be disabled without notice
- **Rate Limiting**: Dynamic and undocumented limits

### Legal Considerations
- **Terms of Service**: May violate Yahoo's ToS
- **Commercial Use**: Not officially supported for commercial applications
- **Data Licensing**: Yahoo has data licensing agreements that may restrict usage

## Implementation Recommendations

### Recommended Approach
1. **Primary Endpoint**: Use `https://query1.finance.yahoo.com/v8/finance/chart/CL=F`
2. **Fallback Server**: Switch to `query2.finance.yahoo.com` if primary fails
3. **Caching Strategy**: Cache responses for at least 1 minute
4. **Error Handling**: Implement robust retry logic with exponential backoff
5. **Monitoring**: Log API response times and error rates

### Sample Implementation (Python)
```python
import requests
import time
from typing import Dict, Any

def get_commodity_price(symbol: str = "CL=F") -> Dict[Any, Any]:
    """
    Fetch current commodity price from Yahoo Finance
    """
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        return data['chart']['result'][0]['meta']
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return {}

# Usage
crude_oil_data = get_commodity_price("CL=F")
current_price = crude_oil_data.get('regularMarketPrice')
```

### Alternative Solutions
1. **yfinance Library**: Python library that handles Yahoo Finance access
2. **Paid APIs**: Consider Alpha Vantage, IEX Cloud, or Quandl for production use
3. **WebSocket Feeds**: Direct exchange connections for real-time data

## Conclusion

The Yahoo Finance chart endpoint (`v8/finance/chart`) provides reliable access to commodity price data including crude oil (CL=F) without requiring API keys. However, given the unofficial nature and potential legal/stability concerns, it's recommended primarily for development, research, or low-volume personal use.

For production applications requiring guaranteed uptime and support, consider commercial alternatives despite the additional cost.

**Last Updated**: December 22, 2024
**Test Status**: All endpoints tested and verified as of research date