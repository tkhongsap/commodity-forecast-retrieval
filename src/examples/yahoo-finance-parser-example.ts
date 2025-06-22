/**
 * Yahoo Finance Parser Usage Example
 * 
 * Demonstrates how to use the Yahoo Finance response parser to convert
 * Yahoo Finance data to CommodityData format for seamless integration
 * with the existing commodity forecasting system.
 * 
 * @author Yahoo Finance Parser Example
 * @version 1.0.0
 */

import {
  YahooFinanceParser,
  YahooFinanceParserException,
  ParserOptions,
  SymbolMapping,
  parseYahooFinanceToCommodityData,
  parseYahooFinancePriceDataToCommodityData,
  DEFAULT_SYMBOL_MAPPINGS
} from '../utils/yahoo-finance-parser';

import {
  YahooFinanceCommodityService,
  createYahooFinanceCommodityService,
  fetchCommodityData,
  fetchMultipleCommodityData
} from '../services/yahoo-finance-commodity-service';

import { getYahooFinanceService } from '../services/yahoo-finance-service';
import { CommodityData, ValidationResult } from '../types/commodity';

/**
 * Example 1: Basic parser usage with convenience functions
 */
async function basicParserUsage() {
  console.log('\n=== Example 1: Basic Parser Usage ===');
  
  try {
    // Fetch commodity data directly using convenience function
    const commodityData = await fetchCommodityData('CL=F', {
      validateData: true,
      strictValidation: false,
      includeExtendedMetadata: true
    });

    console.log('Successfully fetched commodity data:');
    console.log(`- Symbol: ${commodityData.symbol}`);
    console.log(`- Name: ${commodityData.name}`);
    console.log(`- Current Price: ${commodityData.currency} ${commodityData.currentPrice}`);
    console.log(`- Unit: ${commodityData.unit}`);
    console.log(`- Last Updated: ${commodityData.lastUpdated}`);
    console.log(`- Sources: ${commodityData.sources.map(s => s.name).join(', ')}`);

  } catch (error) {
    console.error('Error fetching commodity data:', error);
  }
}

/**
 * Example 2: Multiple commodities fetching
 */
async function multipleCommoditiesUsage() {
  console.log('\n=== Example 2: Multiple Commodities Fetching ===');
  
  try {
    const symbols = ['CL=F', 'GC=F', 'NG=F', 'SI=F'];
    const result = await fetchMultipleCommodityData(symbols, {
      validateData: true,
      useCache: true,
      maxDataAge: 30 * 60 * 1000 // 30 minutes
    });

    console.log(`Successfully fetched ${result.success.length}/${symbols.length} commodities`);
    console.log(`Success rate: ${result.successRate.toFixed(1)}%`);

    result.success.forEach(commodity => {
      console.log(`- ${commodity.name} (${commodity.symbol}): ${commodity.currency} ${commodity.currentPrice}`);
    });

    if (result.failures.length > 0) {
      console.log('\nFailures:');
      result.failures.forEach(failure => {
        console.log(`- ${failure.symbol}: ${failure.error.message} (Retryable: ${failure.retryable})`);
      });
    }

  } catch (error) {
    console.error('Error fetching multiple commodities:', error);
  }
}

/**
 * Example 3: Advanced parser configuration with custom mappings
 */
async function advancedParserConfiguration() {
  console.log('\n=== Example 3: Advanced Parser Configuration ===');
  
  try {
    // Create custom symbol mappings
    const customMappings: Record<string, SymbolMapping> = {
      'BTC-USD': {
        yahooSymbol: 'BTC-USD',
        commodityName: 'Bitcoin',
        unit: 'USD per BTC',
        currency: 'USD',
        type: 'commodity'
      },
      'ETH-USD': {
        yahooSymbol: 'ETH-USD',
        commodityName: 'Ethereum',
        unit: 'USD per ETH',
        currency: 'USD',
        type: 'commodity'
      }
    };

    // Create service with custom mappings
    const commodityService = createYahooFinanceCommodityService(
      undefined, // Use default Yahoo Finance service
      customMappings
    );

    // Add additional custom mapping
    commodityService.addSymbolMapping('DOGE-USD', {
      yahooSymbol: 'DOGE-USD',
      commodityName: 'Dogecoin',
      unit: 'USD per DOGE',
      currency: 'USD',
      type: 'commodity'
    });

    console.log('Supported symbols:', commodityService.getSupportedSymbols());
    console.log('BTC supported:', commodityService.isSymbolSupported('BTC-USD'));
    console.log('DOGE supported:', commodityService.isSymbolSupported('DOGE-USD'));

  } catch (error) {
    console.error('Error with advanced configuration:', error);
  }
}

/**
 * Example 4: Parser with custom options and validation
 */
async function parserWithCustomOptions() {
  console.log('\n=== Example 4: Parser with Custom Options ===');
  
  try {
    const parser = new YahooFinanceParser();
    const yahooService = getYahooFinanceService();

    // Fetch raw Yahoo Finance data
    const priceData = await yahooService.getQuoteData('GC=F');
    console.log('Raw Yahoo Finance data fetched for Gold');

    // Parse with custom options
    const parserOptions: ParserOptions = {
      validateData: true,
      strictValidation: true,
      includeExtendedMetadata: true,
      currencyOverride: 'EUR', // Convert to EUR pricing
      unitOverride: 'EUR per troy ounce',
      sourceUrl: 'https://custom-data-source.com/gold'
    };

    const commodityData = parser.parseFromPriceData(priceData, parserOptions);

    console.log('Parsed commodity data with custom options:');
    console.log(`- Name: ${commodityData.name}`);
    console.log(`- Price: ${commodityData.currency} ${commodityData.currentPrice}`);
    console.log(`- Unit: ${commodityData.unit}`);
    console.log(`- Source URL: ${commodityData.sources[0].url}`);

    // Validate the parsed data
    const commodityService = new YahooFinanceCommodityService();
    const validation = commodityService.validateCommodityData(commodityData);
    
    console.log('\nValidation result:');
    console.log(`- Valid: ${validation.isValid}`);
    console.log(`- Errors: ${validation.errors.length}`);
    console.log(`- Warnings: ${validation.warnings.length}`);

    if (validation.warnings.length > 0) {
      console.log('Warnings:', validation.warnings);
    }

  } catch (error) {
    console.error('Error with custom options:', error);
  }
}

/**
 * Example 5: Error handling and recovery
 */
async function errorHandlingExample() {
  console.log('\n=== Example 5: Error Handling and Recovery ===');
  
  try {
    const commodityService = new YahooFinanceCommodityService();

    // Try to fetch data for an invalid symbol
    try {
      await commodityService.getCommodityData('INVALID_SYMBOL');
    } catch (error) {
      if (error instanceof YahooFinanceParserException) {
        console.log('Parser error details:');
        console.log(`- Error type: ${error.errorType}`);
        console.log(`- Symbol: ${error.symbol}`);
        console.log(`- Message: ${error.message}`);
        console.log('- Has original data:', !!error.originalData);
      }
    }

    // Demonstrate graceful handling with multiple symbols
    const mixedSymbols = ['CL=F', 'INVALID1', 'GC=F', 'INVALID2'];
    const result = await commodityService.getMultipleCommodityData(mixedSymbols);

    console.log(`\nProcessed ${mixedSymbols.length} symbols:`);
    console.log(`- Successful: ${result.success.length}`);
    console.log(`- Failed: ${result.failures.length}`);
    console.log(`- Success rate: ${result.successRate.toFixed(1)}%`);

    // Show retry recommendations
    const retryableFailures = result.failures.filter(f => f.retryable);
    if (retryableFailures.length > 0) {
      console.log(`\nRetryable failures (${retryableFailures.length}):`);
      retryableFailures.forEach(failure => {
        console.log(`- ${failure.symbol}: ${failure.error.message}`);
      });
    }

  } catch (error) {
    console.error('Unexpected error in error handling example:', error);
  }
}

/**
 * Example 6: Integration with existing commodity analysis
 */
async function commodityAnalysisIntegration() {
  console.log('\n=== Example 6: Commodity Analysis Integration ===');
  
  try {
    const commodityService = new YahooFinanceCommodityService();

    // Fetch commodity data
    const commodityData = await commodityService.getCommodityData('CL=F', {
      validateData: true,
      includeExtendedData: true
    });

    // Create basic analysis structure
    const analysis = commodityService.createBasicAnalysis(
      commodityData,
      'Market showing mixed signals with technical indicators suggesting consolidation'
    );

    console.log('Commodity Analysis:');
    console.log(`- Commodity: ${analysis.commodity.name}`);
    console.log(`- Current Price: ${analysis.commodity.currency} ${analysis.commodity.currentPrice}`);
    console.log(`- Analysis Date: ${analysis.analysisDate}`);
    console.log(`- Overall Trend: ${analysis.overallTrend}`);
    console.log(`- Market Sentiment: ${analysis.marketSentiment}`);
    console.log(`- Risk Factors: ${analysis.riskFactors?.join(', ')}`);

    // This analysis object can now be extended with forecasts
    // using the existing forecasting system

  } catch (error) {
    console.error('Error in commodity analysis integration:', error);
  }
}

/**
 * Example 7: Service statistics and monitoring
 */
async function serviceMonitoring() {
  console.log('\n=== Example 7: Service Statistics and Monitoring ===');
  
  try {
    const commodityService = new YahooFinanceCommodityService();

    // Make several requests to generate statistics
    const symbols = ['CL=F', 'GC=F', 'NG=F'];
    for (const symbol of symbols) {
      try {
        await commodityService.getCommodityData(symbol);
      } catch (error) {
        // Ignore errors for statistics demo
      }
    }

    // Get service statistics
    const stats = commodityService.getServiceStats();
    
    console.log('Service Statistics:');
    console.log(`- Total Requests: ${stats.totalRequests}`);
    console.log(`- Successful Requests: ${stats.successfulRequests}`);
    console.log(`- Failed Requests: ${stats.failedRequests}`);
    console.log(`- Success Rate: ${stats.successRate.toFixed(1)}%`);
    console.log(`- Average Response Time: ${stats.averageResponseTime.toFixed(0)}ms`);
    console.log(`- Cache Hit Rate: ${stats.cacheHitRate.toFixed(1)}%`);
    
    if (stats.topSymbols.length > 0) {
      console.log('Top Requested Symbols:');
      stats.topSymbols.forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.symbol}: ${entry.count} requests`);
      });
    }

  } catch (error) {
    console.error('Error in service monitoring:', error);
  }
}

/**
 * Main example runner
 */
async function runAllExamples() {
  console.log('Yahoo Finance Parser Examples');
  console.log('============================');

  try {
    await basicParserUsage();
    await multipleCommoditiesUsage();
    await advancedParserConfiguration();
    await parserWithCustomOptions();
    await errorHandlingExample();
    await commodityAnalysisIntegration();
    await serviceMonitoring();

    console.log('\n=== All Examples Completed Successfully ===');

  } catch (error) {
    console.error('Error running examples:', error);
  }
}

/**
 * Export examples for individual testing
 */
export {
  basicParserUsage,
  multipleCommoditiesUsage,
  advancedParserConfiguration,
  parserWithCustomOptions,
  errorHandlingExample,
  commodityAnalysisIntegration,
  serviceMonitoring,
  runAllExamples
};

/**
 * Run examples if this file is executed directly
 */
if (require.main === module) {
  runAllExamples()
    .then(() => {
      console.log('Examples completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Examples failed:', error);
      process.exit(1);
    });
}