/**
 * Yahoo Finance Service Usage Examples
 * 
 * Demonstrates how to use the YahooFinanceService for fetching
 * commodity price data, quotes, and historical information.
 * 
 * @author Yahoo Finance Service Examples
 * @version 1.0.0
 */

import { getYahooFinanceService } from '../services/yahoo-finance-service';
import { COMMODITY_SYMBOLS } from '../config/yahoo-finance';

/**
 * Example 1: Get current price for crude oil
 */
async function getCurrentPriceExample(): Promise<void> {
  console.log('\n=== Current Price Example ===');
  
  try {
    const service = getYahooFinanceService();
    const symbol = COMMODITY_SYMBOLS.CRUDE_OIL_WTI.symbol;
    
    console.log(`Fetching current price for ${symbol}...`);
    const price = await service.getCurrentPrice(symbol);
    
    console.log(`Current WTI Crude Oil price: $${price.toFixed(2)}`);
  } catch (error) {
    console.error('Error fetching current price:', error);
  }
}

/**
 * Example 2: Get comprehensive quote data
 */
async function getQuoteDataExample(): Promise<void> {
  console.log('\n=== Quote Data Example ===');
  
  try {
    const service = getYahooFinanceService();
    const symbol = COMMODITY_SYMBOLS.GOLD.symbol;
    
    console.log(`Fetching quote data for ${symbol}...`);
    const quoteData = await service.getQuoteData(symbol, {
      validatePrice: true,
      useCache: true
    });
    
    console.log('Gold Quote Data:');
    console.log(`  Symbol: ${quoteData.symbol}`);
    console.log(`  Current Price: $${quoteData.currentPrice.toFixed(2)} ${quoteData.currency}`);
    console.log(`  Previous Close: $${quoteData.previousClose.toFixed(2)}`);
    console.log(`  Price Change: $${quoteData.priceChange.toFixed(2)} (${quoteData.percentChange.toFixed(2)}%)`);
    console.log(`  Day Range: $${quoteData.dayLow.toFixed(2)} - $${quoteData.dayHigh.toFixed(2)}`);
    console.log(`  52-Week Range: $${quoteData.yearLow.toFixed(2)} - $${quoteData.yearHigh.toFixed(2)}`);
    console.log(`  Volume: ${quoteData.volume.toLocaleString()}`);
    console.log(`  Exchange: ${quoteData.exchange}`);
    console.log(`  Last Updated: ${quoteData.lastUpdated}`);
  } catch (error) {
    console.error('Error fetching quote data:', error);
  }
}

/**
 * Example 3: Get historical chart data
 */
async function getHistoricalDataExample(): Promise<void> {
  console.log('\n=== Historical Data Example ===');
  
  try {
    const service = getYahooFinanceService();
    const symbol = COMMODITY_SYMBOLS.NATURAL_GAS.symbol;
    
    console.log(`Fetching historical data for ${symbol}...`);
    const historicalData = await service.getChartData(symbol, {
      interval: '1d',
      range: '1mo',
      includeVolume: true,
      validateData: true,
      maxDataPoints: 10 // Limit for example output
    });
    
    console.log(`Natural Gas Historical Data (${historicalData.interval}, ${historicalData.range}):`);
    console.log(`  Symbol: ${historicalData.symbol}`);
    console.log(`  Data Points: ${historicalData.prices.length}`);
    console.log('\n  Recent Prices:');
    
    // Show last 5 data points
    const recentPrices = historicalData.prices.slice(-5);
    recentPrices.forEach(price => {
      console.log(`    ${price.date}: Open=$${price.open?.toFixed(3) || 'N/A'}, ` +
                 `High=$${price.high?.toFixed(3) || 'N/A'}, ` +
                 `Low=$${price.low?.toFixed(3) || 'N/A'}, ` +
                 `Close=$${price.close?.toFixed(3) || 'N/A'}, ` +
                 `Volume=${price.volume?.toLocaleString() || 'N/A'}`);
    });
  } catch (error) {
    console.error('Error fetching historical data:', error);
  }
}

/**
 * Example 4: Get multiple commodity prices efficiently
 */
async function getMultiplePricesExample(): Promise<void> {
  console.log('\n=== Multiple Prices Example ===');
  
  try {
    const service = getYahooFinanceService();
    const symbols = [
      COMMODITY_SYMBOLS.CRUDE_OIL_WTI.symbol,
      COMMODITY_SYMBOLS.GOLD.symbol,
      COMMODITY_SYMBOLS.SILVER.symbol,
      COMMODITY_SYMBOLS.NATURAL_GAS.symbol,
      COMMODITY_SYMBOLS.CORN.symbol
    ];
    
    console.log('Fetching multiple commodity prices...');
    const pricesMap = await service.getMultiplePrices(symbols);
    
    console.log('\nCommodity Prices:');
    pricesMap.forEach((price, symbol) => {
      const config = Object.values(COMMODITY_SYMBOLS).find(c => c.symbol === symbol);
      const name = config?.name || symbol;
      console.log(`  ${name}: $${price.toFixed(2)}`);
    });
    
    console.log(`\nSuccessfully fetched ${pricesMap.size} prices`);
  } catch (error) {
    console.error('Error fetching multiple prices:', error);
  }
}

/**
 * Example 5: Market status check
 */
async function getMarketStatusExample(): Promise<void> {
  console.log('\n=== Market Status Example ===');
  
  try {
    const service = getYahooFinanceService();
    const symbol = COMMODITY_SYMBOLS.CRUDE_OIL_WTI.symbol;
    
    console.log(`Checking market status for ${symbol}...`);
    const marketStatus = await service.getMarketStatus(symbol);
    
    console.log('Market Status:');
    console.log(`  Market: ${marketStatus.market}`);
    console.log(`  Status: ${marketStatus.status}`);
    console.log(`  Timezone: ${marketStatus.timezone}`);
    console.log(`  Extended Hours: ${marketStatus.extendedHours}`);
  } catch (error) {
    console.error('Error fetching market status:', error);
  }
}

/**
 * Example 6: Service cache and statistics
 */
async function getCacheStatsExample(): Promise<void> {
  console.log('\n=== Cache Statistics Example ===');
  
  try {
    const service = getYahooFinanceService();
    
    // Fetch some data to populate cache
    await service.getCurrentPrice(COMMODITY_SYMBOLS.GOLD.symbol);
    await service.getCurrentPrice(COMMODITY_SYMBOLS.SILVER.symbol);
    
    const cacheStats = service.getCacheStats();
    console.log('Cache Statistics:');
    console.log(`  Cache Size: ${cacheStats.size} entries`);
    console.log(`  Memory Usage: ${(cacheStats.memoryUsage / 1024).toFixed(2)} KB`);
    console.log(`  Cached Keys: ${cacheStats.entries.join(', ')}`);
  } catch (error) {
    console.error('Error with cache operations:', error);
  }
}

/**
 * Main function to run all examples
 */
async function runAllExamples(): Promise<void> {
  console.log('Yahoo Finance Service Examples');
  console.log('=====================================');
  
  try {
    await getCurrentPriceExample();
    await getQuoteDataExample();
    await getHistoricalDataExample();
    await getMultiplePricesExample();
    await getMarketStatusExample();
    await getCacheStatsExample();
    
    console.log('\n=== Examples Completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

/**
 * Error handling example
 */
async function errorHandlingExample(): Promise<void> {
  console.log('\n=== Error Handling Example ===');
  
  try {
    const service = getYahooFinanceService();
    
    // Try to fetch data for an invalid symbol
    console.log('Testing invalid symbol handling...');
    await service.getCurrentPrice('INVALID_SYMBOL');
  } catch (error) {
    console.log('Caught expected error for invalid symbol:');
    console.log(`  Error Type: ${(error as any).errorType || 'Unknown'}`);
    console.log(`  Message: ${(error as Error).message}`);
    console.log(`  Retryable: ${(error as any).retryable || false}`);
  }
}

// Export functions for individual testing
export {
  getCurrentPriceExample,
  getQuoteDataExample,
  getHistoricalDataExample,
  getMultiplePricesExample,
  getMarketStatusExample,
  getCacheStatsExample,
  errorHandlingExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Example execution failed:', error);
      process.exit(1);
    });
}