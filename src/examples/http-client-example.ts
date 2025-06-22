/**
 * Yahoo Finance HTTP Client Usage Examples
 * 
 * Demonstrates how to use the HTTP client for Yahoo Finance API calls
 * with proper error handling and rate limiting.
 * 
 * @author HTTP Client Example Module
 * @version 1.0.0
 */

import { getHttpClient, HttpClientError } from '../utils/http-client';
import { COMMODITY_SYMBOLS } from '../config/yahoo-finance';

/**
 * Example: Get current price for crude oil
 */
async function getCurrentOilPrice(): Promise<void> {
  const client = getHttpClient();
  
  try {
    console.log('Fetching current crude oil price...');
    
    const response = await client.getChart(
      COMMODITY_SYMBOLS.CRUDE_OIL_WTI.symbol,
      '1d',
      '1d'
    );
    
    if (response.success && response.data && response.data.chart.result && response.data.chart.result[0]) {
      const result = response.data.chart.result[0];
      const latestPrice = result.meta.regularMarketPrice;
      const previousClose = result.meta.chartPreviousClose;
      const change = latestPrice - previousClose;
      const changePercent = (change / previousClose) * 100;
      
      console.log('✅ Crude Oil WTI Current Data:');
      console.log(`   Price: $${latestPrice.toFixed(2)}`);
      console.log(`   Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`);
      console.log(`   Exchange: ${result.meta.exchangeName}`);
      console.log(`   Last Updated: ${new Date(result.meta.regularMarketTime * 1000).toISOString()}`);
    } else {
      console.error('❌ Failed to fetch oil price:', response.error);
    }
  } catch (error) {
    if (error instanceof HttpClientError) {
      console.error(`❌ HTTP Error (${error.type}):`, error.message);
      console.error(`   Status Code: ${error.statusCode}`);
      console.error(`   Retry Count: ${error.retryCount}`);
    } else {
      console.error('❌ Unexpected error:', error);
    }
  }
}

/**
 * Example: Get multiple commodity prices
 */
async function getMultipleCommodityPrices(): Promise<void> {
  const client = getHttpClient();
  
  const commodities = [
    { name: 'Crude Oil WTI', symbol: COMMODITY_SYMBOLS.CRUDE_OIL_WTI.symbol },
    { name: 'Gold', symbol: COMMODITY_SYMBOLS.GOLD.symbol },
    { name: 'Silver', symbol: COMMODITY_SYMBOLS.SILVER.symbol },
    { name: 'Natural Gas', symbol: COMMODITY_SYMBOLS.NATURAL_GAS.symbol }
  ];
  
  console.log('Fetching multiple commodity prices...');
  
  for (const commodity of commodities) {
    try {
      const response = await client.getChart(commodity.symbol, '1d', '1d');
      
      if (response.success && response.data && response.data.chart.result && response.data.chart.result[0]) {
        const result = response.data.chart.result[0];
        const price = result.meta.regularMarketPrice;
        const currency = result.meta.currency;
        
        console.log(`✅ ${commodity.name}: ${currency} ${price.toFixed(2)}`);
      } else {
        console.log(`❌ ${commodity.name}: Failed to fetch`);
      }
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ ${commodity.name}: Error -`, error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

/**
 * Example: Test rate limiting behavior
 */
async function testRateLimiting(): Promise<void> {
  const client = getHttpClient();
  
  console.log('Testing rate limiting behavior...');
  console.log('Current rate limit status:', client.getRateLimit());
  
  // Make multiple rapid requests to test rate limiting
  const requests = Array.from({ length: 15 }, (_, i) => 
    client.getChart(COMMODITY_SYMBOLS.CRUDE_OIL_WTI.symbol, '1d', '1d')
      .then(() => console.log(`✅ Request ${i + 1} completed`))
      .catch(error => console.log(`❌ Request ${i + 1} failed:`, error.message))
  );
  
  await Promise.allSettled(requests);
  
  console.log('Final rate limit status:', client.getRateLimit());
}

/**
 * Example: Test error handling with invalid symbol
 */
async function testErrorHandling(): Promise<void> {
  const client = getHttpClient();
  
  console.log('Testing error handling with invalid symbol...');
  
  try {
    const response = await client.getChart('INVALID_SYMBOL', '1d', '1d');
    
    if (!response.success) {
      console.log('❌ Expected error occurred:', response.error);
      console.log('   Status Code:', response.statusCode);
    } else {
      console.log('⚠️  Unexpected success with invalid symbol');
    }
  } catch (error) {
    if (error instanceof HttpClientError) {
      console.log(`❌ HTTP Client Error: ${error.type}`);
      console.log(`   Message: ${error.message}`);
      console.log(`   Status: ${error.statusCode}`);
      console.log(`   Retries: ${error.retryCount}`);
    }
  }
}

/**
 * Example: Get historical data
 */
async function getHistoricalData(): Promise<void> {
  const client = getHttpClient();
  
  console.log('Fetching historical gold price data (1 month)...');
  
  try {
    const response = await client.getChart(
      COMMODITY_SYMBOLS.GOLD.symbol,
      '1d',
      '1mo'
    );
    
    if (response.success && response.data && response.data.chart.result && response.data.chart.result[0]) {
      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote;
      if (!quotes || quotes.length === 0 || !quotes[0]) {
        console.error('❌ No quote data available');
        return;
      }
      const prices = quotes[0].close;
      
      if (timestamps && timestamps.length > 0) {
        const firstTimestamp = timestamps[0];
        const lastTimestamp = timestamps[timestamps.length - 1];
        
        if (firstTimestamp && lastTimestamp) {
          console.log(`✅ Retrieved ${timestamps.length} data points for Gold`);
          console.log('   Date Range:', 
            new Date(firstTimestamp * 1000).toDateString(),
            'to',
            new Date(lastTimestamp * 1000).toDateString()
          );
        } else {
          console.log(`✅ Retrieved ${timestamps.length} data points for Gold`);
          console.log('   Warning: Some timestamp data is missing');
        }
        
        // Calculate some basic statistics
        if (prices && prices.length > 0) {
          const validPrices = prices.filter(p => p !== null) as number[];
          if (validPrices.length > 0) {
            const avgPrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
            const minPrice = Math.min(...validPrices);
            const maxPrice = Math.max(...validPrices);
            
            console.log('   Statistics:');
            console.log(`     Average: $${avgPrice.toFixed(2)}`);
            console.log(`     Min: $${minPrice.toFixed(2)}`);
            console.log(`     Max: $${maxPrice.toFixed(2)}`);
          } else {
            console.log('   No valid price data available');
          }
        } else {
          console.log('   No price data available');
        }
      } else {
        console.log('   No timestamp data available');
      }
    } else {
      console.error('❌ Failed to fetch historical data:', response.error);
    }
  } catch (error) {
    console.error('❌ Error fetching historical data:', error);
  }
}

/**
 * Main example runner
 */
async function runExamples(): Promise<void> {
  console.log('🚀 Yahoo Finance HTTP Client Examples\n');
  
  try {
    // Display client configuration
    const client = getHttpClient();
    console.log('📋 Client Configuration:', client.getConfig());
    console.log('');
    
    // Run examples
    await getCurrentOilPrice();
    console.log('');
    
    await getMultipleCommodityPrices();
    console.log('');
    
    await getHistoricalData();
    console.log('');
    
    await testErrorHandling();
    console.log('');
    
    // Uncomment to test rate limiting (makes many requests)
    // await testRateLimiting();
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Export for use in other modules
export {
  getCurrentOilPrice,
  getMultipleCommodityPrices,
  testRateLimiting,
  testErrorHandling,
  getHistoricalData,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}